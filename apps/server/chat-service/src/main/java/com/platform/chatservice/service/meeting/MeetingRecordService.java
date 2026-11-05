package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingRecord;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
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

  /** Per-user in-memory bucket: ~3 lines/s, burst 6. Over the limit => drop silently. */
  private final SpeechRateLimiter limiter = new SpeechRateLimiter(3.0, 6);

  /**
   * (meetingId:userId) -> speaker name, so a chatty speaker costs one profile read, not one per
   * line.
   */
  private final ConcurrentHashMap<String, CachedName> names = new ConcurrentHashMap<>();

  private static final long NAME_TTL_MS = 5 * 60_000L;
  private static final int NAME_CACHE_MAX = 5_000;
  private static final long TS_PAST_WINDOW_MS = 60_000L;

  private record CachedName(String name, long expiresAt) {}

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
    if (!limiter.tryAcquire(caller.getUserId())) {
      return false;
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
    long nowMs = now.toEpochMilli();
    Instant at =
        ts == null
            ? now
            : Instant.ofEpochMilli(Math.max(nowMs - TS_PAST_WINDOW_MS, Math.min(ts, nowMs)));
    append(
        MeetingRecord.builder()
            .meetingId(meetingId)
            .kind(MeetingRecord.Kind.SPEECH)
            .userId(caller.getUserId())
            .displayName(speakerName(meetingId, caller.getUserId(), nowMs))
            .text(clean)
            .ts(at)
            .build());
    return true;
  }

  private String speakerName(String meetingId, String userId, long nowMs) {
    String key = meetingId + ":" + userId;
    CachedName hit = names.get(key);
    if (hit != null && hit.expiresAt() > nowMs) {
      return hit.name();
    }
    PersonDto person = people.profiles(List.of(userId)).get(userId);
    String name = person == null ? null : person.displayName();
    if (names.size() >= NAME_CACHE_MAX) {
      names.clear();
    }
    names.put(key, new CachedName(name, nowMs + NAME_TTL_MS));
    return name;
  }

  public MeetingRecord append(MeetingRecord r) {
    r.setCreatedAt(Instant.now());
    return mongo.insert(r);
  }

  /** Records of a meeting, oldest first. */
  public List<MeetingRecord> list(String meetingId) {
    return mongo.find(
        new Query(Criteria.where("meetingId").is(meetingId)).with(Sort.by("ts")),
        MeetingRecord.class);
  }
}
