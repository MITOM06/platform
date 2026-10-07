package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.PageLimits;
import com.platform.chatservice.service.RateLimiterService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * In-meeting chat: text lines stored in {@code meeting_messages} and announced to the room as
 * {@code meet.chat}. Sending needs room access ({@link MeetingGuard#inRoom}); reading the history
 * needs record access ({@link MeetingGuard#records}) and keeps working after the meeting ended.
 */
@Service
@RequiredArgsConstructor
public class MeetingChatService {

  static final int CONTENT_MAX = 2000;
  static final int DEFAULT_PAGE_SIZE = 50;
  static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");

  private final MongoTemplate mongo;
  private final MeetingGuard guard;
  private final MeetingPeople people;
  private final MeetingEvents events;
  private final RateLimiterService rateLimiter;

  /**
   * Stores one chat line and tells the room. Order: room access → content (trimmed, 1..2000) → rate
   * limit (shared with normal chat; checked after validation so a refused line costs nothing) →
   * insert → {@code meet.chat}. A malformed {@code clientId} is dropped, never refused.
   */
  public MeetingMessageDto send(
      UserPrincipal caller, String meetingId, String content, String clientId) {
    guard.inRoom(caller, meetingId);
    String text = content == null ? "" : content.trim();
    if (text.isEmpty()) {
      throw MeetingRequests.invalid("content");
    }
    if (text.length() > CONTENT_MAX) {
      throw MeetingRequests.invalid("content", CONTENT_MAX);
    }
    String uid = caller.getUserId();
    rateLimiter.checkMessageRate(uid);

    MeetingMessage saved =
        mongo.insert(
            MeetingMessage.builder()
                .meetingId(meetingId)
                .senderId(uid)
                .content(text)
                .createdAt(Instant.now().truncatedTo(ChronoUnit.MILLIS))
                .build());
    MeetingMessageDto dto = toDto(saved, people.profiles(List.of(uid)));
    events.chat(meetingId, dto, clientIdOrNull(clientId));
    return dto;
  }

  /**
   * One page of the history, newest first. {@code before} is the id of the oldest line the client
   * has (absent = newest page); an unknown cursor or one from another meeting gives an empty page.
   * Cursor is the compound {@code (createdAt, _id)} so lines sharing a millisecond are never
   * skipped (same as {@code MessageQueryService}).
   */
  public PageResponse<MeetingMessageDto> history(
      UserPrincipal caller, String meetingId, String before, int size) {
    guard.records(caller, meetingId);
    int limit = PageLimits.size(size, DEFAULT_PAGE_SIZE);

    List<Criteria> ands = new ArrayList<>();
    ands.add(Criteria.where("meetingId").is(meetingId));
    if (before != null && !before.isBlank()) {
      MeetingMessage cursor = mongo.findById(before, MeetingMessage.class);
      if (cursor == null
          || cursor.getCreatedAt() == null
          || !Objects.equals(cursor.getMeetingId(), meetingId)) {
        return new PageResponse<>(List.of(), 0, limit, 0);
      }
      Instant at = cursor.getCreatedAt();
      // _id compares by its stored BSON type: ObjectId for generated ids, String otherwise.
      Object cursorId = ObjectId.isValid(before) ? new ObjectId(before) : before;
      ands.add(
          new Criteria()
              .orOperator(
                  Criteria.where("createdAt").lt(at),
                  new Criteria()
                      .andOperator(
                          Criteria.where("createdAt").is(at), Criteria.where("_id").lt(cursorId))));
    }
    Query query =
        new Query(new Criteria().andOperator(ands.toArray(new Criteria[0])))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(limit + 1);
    List<MeetingMessage> rows = mongo.find(query, MeetingMessage.class);

    boolean hasMore = rows.size() > limit;
    List<MeetingMessage> page = hasMore ? rows.subList(0, limit) : rows;
    Set<String> senders = new LinkedHashSet<>();
    for (MeetingMessage row : page) {
      if (row.getSenderId() != null) {
        senders.add(row.getSenderId());
      }
    }
    Map<String, PersonDto> profiles = senders.isEmpty() ? Map.of() : people.profiles(senders);
    List<MeetingMessageDto> content = page.stream().map(row -> toDto(row, profiles)).toList();
    // page=0 always; totalElements is synthetic so hasNext() reflects `hasMore`.
    return new PageResponse<>(content, 0, limit, hasMore ? limit + 1 : content.size());
  }

  private static MeetingMessageDto toDto(MeetingMessage row, Map<String, PersonDto> profiles) {
    return new MeetingMessageDto(
        row.getId(),
        MeetingMapper.person(row.getSenderId(), profiles),
        row.getContent(),
        row.getCreatedAt());
  }

  /**
   * The client's optimistic-message id when it is well formed ({@code [A-Za-z0-9_-]{1,64}}), else
   * null — a junk value is dropped, never echoed back.
   */
  public static String clientIdOrNull(String clientId) {
    return clientId != null && CLIENT_ID.matcher(clientId).matches() ? clientId : null;
  }
}
