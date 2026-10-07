package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.HandDto;
import com.platform.chatservice.dto.meeting.MeetingHandsResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.stereotype.Service;

/**
 * Raised hands of a meeting, in raise order: Redis sorted set {@code meet:hands:{id}} (userId →
 * epoch millis of the raise). {@code ZADD NX} keeps your place when you raise again. Every real
 * change is announced to the room as {@code meet.hands} with the whole ordered list.
 */
@Service
@RequiredArgsConstructor
public class MeetingHandService {

  private final StringRedisTemplate redis;
  private final MeetingGuard guard;
  private final MeetingPeople people;
  private final MeetingEvents events;

  /** Raise / lower the caller's own hand; refusals come from {@link MeetingGuard#inRoom}. */
  public void setHand(UserPrincipal caller, String meetingId, boolean raised) {
    guard.inRoom(caller, meetingId);
    String uid = caller.getUserId();
    if (!raised) {
      lower(meetingId, uid);
      return;
    }
    String key = MeetingLobby.handsKey(meetingId);
    Boolean added = redis.opsForZSet().addIfAbsent(key, uid, (double) Instant.now().toEpochMilli());
    if (Boolean.TRUE.equals(added)) {
      redis.expire(key, MeetingLobby.TTL);
      publish(meetingId);
    }
  }

  /**
   * Lowers {@code userId}'s hand without checking who asks (the host command already checked, or
   * the person left the room). True when a hand was actually lowered.
   */
  public boolean lower(String meetingId, String userId) {
    Long removed = redis.opsForZSet().remove(MeetingLobby.handsKey(meetingId), userId);
    if (removed != null && removed == 1L) {
      publish(meetingId);
      return true;
    }
    return false;
  }

  /** Lowers every hand; announces {@code []} only when there were hands up. */
  public void lowerAll(String meetingId) {
    if (Boolean.TRUE.equals(redis.delete(MeetingLobby.handsKey(meetingId)))) {
      events.hands(meetingId, List.of());
    }
  }

  /** Raised hands, earliest first, named through one profile lookup (never the id as a name). */
  public List<HandDto> hands(String meetingId) {
    Set<TypedTuple<String>> rows =
        redis.opsForZSet().rangeWithScores(MeetingLobby.handsKey(meetingId), 0, -1);
    List<HandDto> out = new ArrayList<>();
    if (rows == null || rows.isEmpty()) {
      return out;
    }
    List<String> ids = new ArrayList<>();
    for (TypedTuple<String> row : rows) {
      if (row.getValue() != null) {
        ids.add(row.getValue());
      }
    }
    Map<String, PersonDto> profiles = people.profiles(ids);
    for (TypedTuple<String> row : rows) {
      String userId = row.getValue();
      if (userId == null) {
        continue;
      }
      Double score = row.getScore();
      Instant raisedAt = score == null ? null : Instant.ofEpochMilli(score.longValue());
      out.add(new HandDto(userId, MeetingMapper.person(userId, profiles).displayName(), raisedAt));
    }
    return out;
  }

  /** {@code GET /api/meetings/{id}/hands} — for a client that joins or reconnects mid-meeting. */
  public MeetingHandsResponse snapshot(UserPrincipal caller, String meetingId) {
    guard.inRoom(caller, meetingId);
    return new MeetingHandsResponse(hands(meetingId));
  }

  private void publish(String meetingId) {
    events.hands(meetingId, hands(meetingId));
  }
}
