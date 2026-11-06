package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingListItem;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * The ended, AI-noted meetings a user may read (ai-service's "my meetings" tool). Mongo narrows to
 * candidates, then {@link MeetingAccess#canReadRecords} decides — the permission rule stays in this
 * service. A user admitted from the lobby who never attended is not a candidate (the Redis
 * "admitted" set only lives 24 h anyway). Items never carry a user id.
 */
@Service
@RequiredArgsConstructor
public class MeetingDirectory {

  static final int MAX_LIMIT = 50;

  private final MongoTemplate mongo;
  private final MeetingPeople people;

  public List<MeetingListItem> listReadable(String userId, String q, int limit) {
    if (userId == null || userId.isBlank()) {
      return List.of();
    }
    int cap = Math.max(1, Math.min(limit, MAX_LIMIT));
    List<String> depts = people.departmentIdsOf(userId);

    List<Criteria> anyOf = new ArrayList<>();
    anyOf.add(Criteria.where("hostId").is(userId));
    anyOf.add(Criteria.where("coHostIds").is(userId));
    anyOf.add(Criteria.where("inviteeIds").is(userId));
    anyOf.add(Criteria.where("attendance.userId").is(userId));
    if (!depts.isEmpty()) {
      anyOf.add(Criteria.where("departmentId").in(depts));
    }

    Criteria filter =
        new Criteria()
            .andOperator(
                Criteria.where("status").is(MeetingStatus.ENDED.name()),
                Criteria.where("aiNotesEverEnabled").is(true),
                Criteria.where("removedIds").ne(userId),
                new Criteria().orOperator(anyOf));
    if (q != null && !q.isBlank()) {
      filter =
          new Criteria()
              .andOperator(
                  filter,
                  Criteria.where("title")
                      .regex(Pattern.compile(Pattern.quote(q.strip()), Pattern.CASE_INSENSITIVE)));
    }

    Query query =
        new Query(filter)
            .with(Sort.by(Sort.Direction.DESC, "endedAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(cap);
    return mongo.find(query, Meeting.class).stream()
        .filter(m -> MeetingAccess.canReadRecords(m, userId, depts, false))
        .map(
            m ->
                new MeetingListItem(
                    m.getId(),
                    m.getTitle(),
                    m.getCode(),
                    m.getStartedAt(),
                    m.getEndedAt(),
                    m.getSummaryState() == null ? null : m.getSummaryState().name()))
        .toList();
  }
}
