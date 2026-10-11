package com.platform.chatservice.service;

import com.platform.chatservice.service.rtc.RtcRooms;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Who is in a LiveKit call right now: {@code call:user:{userId}} → callId. Lets a new call to that
 * person answer "busy" at once instead of ringing. Meetings write the same key (with their room
 * name, {@code meet_…}), so being in a meeting also counts as busy.
 *
 * <p>Both writes are single Lua scripts. {@code clear} used to GET then DEL: a {@code markBusy} for
 * a new call landing in between was deleted and the user looked free. And a call no longer takes
 * over a meeting's entry — ending that call then freed someone still in the meeting.
 */
@Component
@RequiredArgsConstructor
public class CallBusyRegistry {

  public static final String KEY_PREFIX = "call:user:";

  /** Safety net for a call that never reports its end. */
  public static final Duration TTL = Duration.ofHours(6);

  /** SET unless a meeting holds the key and the new value is not a meeting. */
  private static final RedisScript<Long> MARK =
      new DefaultRedisScript<>(
          "local v = redis.call('GET', KEYS[1]) "
              + "if v and string.sub(v, 1, string.len(ARGV[3])) == ARGV[3] "
              + "and string.sub(ARGV[1], 1, string.len(ARGV[3])) ~= ARGV[3] then return 0 end "
              + "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]) return 1",
          Long.class);

  /** DEL only while the key still holds this call. */
  private static final RedisScript<Long> CLEAR =
      new DefaultRedisScript<>(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end "
              + "return 0",
          Long.class);

  private final StringRedisTemplate redis;

  public void markBusy(String userId, String callId) {
    if (userId == null || callId == null) {
      return;
    }
    redis.execute(
        MARK,
        List.of(KEY_PREFIX + userId),
        callId,
        String.valueOf(TTL.toSeconds()),
        RtcRooms.MEETING_PREFIX);
  }

  /** The call {@code userId} is in, or null when free. */
  public String busyCallOf(String userId) {
    return userId == null ? null : redis.opsForValue().get(KEY_PREFIX + userId);
  }

  /** Free {@code userId} — but only from {@code callId}, never from a call they moved on to. */
  public void clear(String userId, String callId) {
    if (userId == null || callId == null) {
      return;
    }
    redis.execute(CLEAR, List.of(KEY_PREFIX + userId), callId);
  }
}
