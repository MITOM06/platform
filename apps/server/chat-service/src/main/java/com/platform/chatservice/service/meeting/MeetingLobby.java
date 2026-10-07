package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * The waiting room of a meeting in Redis — shared by every chat-service instance.
 *
 * <ul>
 *   <li>{@code meet:lobby:{id}} — hash userId → displayName ({@code ""} when unknown)
 *   <li>{@code meet:admitted:{id}} — set of people the host let in (they skip the lobby next time)
 *   <li>{@code meet:hands:{id}} — raised hands (MT3); dropped together with the rest
 * </ul>
 *
 * Every key expires {@link #TTL} after its last write so an abandoned meeting cleans itself up.
 */
@Component
@RequiredArgsConstructor
public class MeetingLobby {

  public static final Duration TTL = Duration.ofHours(24);

  private final StringRedisTemplate redis;

  public void add(String meetingId, String userId, String displayName) {
    String key = lobbyKey(meetingId);
    redis.opsForHash().put(key, userId, displayName == null ? "" : displayName);
    redis.expire(key, TTL);
  }

  /** True when the person was waiting (and no longer is). */
  public boolean remove(String meetingId, String userId) {
    Long removed = redis.opsForHash().delete(lobbyKey(meetingId), userId);
    return removed != null && removed == 1L;
  }

  public boolean isWaiting(String meetingId, String userId) {
    return Boolean.TRUE.equals(redis.opsForHash().hasKey(lobbyKey(meetingId), userId));
  }

  /** Everyone waiting, sorted by name (case-insensitive); nameless people last. */
  public List<LobbyEntryDto> waiting(String meetingId) {
    Map<Object, Object> raw = redis.opsForHash().entries(lobbyKey(meetingId));
    List<LobbyEntryDto> out = new ArrayList<>();
    if (raw == null) {
      return out;
    }
    raw.forEach(
        (userId, name) -> {
          String displayName = name == null || name.toString().isBlank() ? null : name.toString();
          out.add(new LobbyEntryDto(userId.toString(), displayName));
        });
    out.sort(
        Comparator.comparing(
                (LobbyEntryDto e) ->
                    e.displayName() == null ? null : e.displayName().toLowerCase(Locale.ROOT),
                Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(LobbyEntryDto::userId));
    return out;
  }

  public void admit(String meetingId, String userId) {
    String key = admittedKey(meetingId);
    redis.opsForSet().add(key, userId);
    redis.expire(key, TTL);
  }

  public boolean isAdmitted(String meetingId, String userId) {
    return Boolean.TRUE.equals(redis.opsForSet().isMember(admittedKey(meetingId), userId));
  }

  /** Drops everything this meeting kept in Redis (on end / cancel). */
  public void clear(String meetingId) {
    redis.delete(List.of(lobbyKey(meetingId), admittedKey(meetingId), handsKey(meetingId)));
  }

  static String lobbyKey(String meetingId) {
    return "meet:lobby:" + meetingId;
  }

  static String admittedKey(String meetingId) {
    return "meet:admitted:" + meetingId;
  }

  static String handsKey(String meetingId) {
    return "meet:hands:" + meetingId;
  }
}
