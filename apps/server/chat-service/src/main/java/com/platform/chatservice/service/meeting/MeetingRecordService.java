package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingRecord;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Raw material for AI meeting notes ({@code meeting_records}). Speech arrives at high frequency, so
 * {@link #appendSpeech} never throws for bad input: it drops silently and returns false.
 */
@Service
@RequiredArgsConstructor
public class MeetingRecordService {

  static final int SPEECH_MAX = 500;

  private final MongoTemplate mongo;
  private final MeetingGuard guard;
  private final MeetingPeople people;

  /**
   * @return true when the line was stored.
   */
  public boolean appendSpeech(UserPrincipal caller, String meetingId, String text, Long ts) {
    if (meetingId == null || text == null) {
      return false;
    }
    String clean = text.strip();
    if (clean.isEmpty()) {
      return false;
    }
    if (clean.length() > SPEECH_MAX) {
      clean = clean.substring(0, SPEECH_MAX);
    }
    Meeting meeting;
    try {
      meeting = guard.inRoom(caller, meetingId);
    } catch (ApiException e) {
      return false;
    }
    // Must be inside NOW (open attendance row): inRoom only checks entitlement, and STT may still
    // run a few seconds after someone left. Known limit: attendance is opened by the LiveKit
    // participant_joined webhook, so speech in the first seconds before it lands is dropped too.
    if (!MeetingAccess.isInside(meeting, caller.getUserId())) {
      return false;
    }
    if (meeting.getSettings() == null || !meeting.getSettings().isAiNotes()) {
      return false;
    }
    Instant now = Instant.now();
    Instant at = ts == null ? now : Instant.ofEpochMilli(Math.min(ts, now.toEpochMilli()));
    PersonDto person = people.profiles(List.of(caller.getUserId())).get(caller.getUserId());
    append(
        MeetingRecord.builder()
            .meetingId(meetingId)
            .kind(MeetingRecord.Kind.SPEECH)
            .userId(caller.getUserId())
            .displayName(person == null ? null : person.displayName())
            .text(clean)
            .ts(at)
            .build());
    return true;
  }

  public MeetingRecord append(MeetingRecord r) {
    return mongo.insert(r);
  }

  /** Records of a meeting, oldest first. */
  public List<MeetingRecord> list(String meetingId) {
    return mongo.find(
        new Query(Criteria.where("meetingId").is(meetingId)).with(Sort.by("ts")),
        MeetingRecord.class);
  }
}
