package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.MeetingSummaryDoc;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/** Persists the AI summaries of meetings ({@code meeting_summaries}). */
@Component
@RequiredArgsConstructor
public class MeetingSummaryStore {

  private final MongoTemplate mongo;

  public MeetingSummaryDoc save(MeetingSummaryDoc doc) {
    return mongo.insert(doc);
  }

  /** The newest summary of the meeting, if any. */
  public Optional<MeetingSummaryDoc> latest(String meetingId) {
    Query query =
        new Query(Criteria.where("meetingId").is(meetingId))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(1);
    return Optional.ofNullable(mongo.findOne(query, MeetingSummaryDoc.class));
  }
}
