package com.platform.chatservice.service;

import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Who is in a LiveKit call right now: {@code call:user:{userId}} → callId. Lets a new call to that
 * person answer "busy" at once instead of ringing. Meetings write the same key, so being in a
 * meeting also counts as busy.
 */
@Component
@RequiredArgsConstructor
public class CallBusyRegistry {

  public static final String KEY_PREFIX = "call:user:";

  /** Safety net for a call that never reports its end. */
  public static final Duration TTL = Duration.ofHours(6);

  private final StringRedisTemplate redis;

  public void markBusy(String userId, String callId) {
    if (userId == null || callId == null) {
      return;
    }
    redis.opsForValue().set(KEY_PREFIX + userId, callId, TTL);
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
    if (callId.equals(redis.opsForValue().get(KEY_PREFIX + userId))) {
      redis.delete(KEY_PREFIX + userId);
    }
  }
}
