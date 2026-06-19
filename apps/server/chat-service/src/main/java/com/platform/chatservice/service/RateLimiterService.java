package com.platform.chatservice.service;

import com.platform.chatservice.exception.RateLimitExceededException;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Fixed-window rate limiter backed by Redis. */
@Service
@RequiredArgsConstructor
public class RateLimiterService {

  private static final int MAX_MESSAGES = 10;
  private static final long MESSAGE_WINDOW_SECONDS = 5;

  private static final int MAX_UPLOADS = 20;
  private static final long UPLOAD_WINDOW_SECONDS = 60;

  private static final int MAX_REACTIONS = 30;
  private static final long REACTION_WINDOW_SECONDS = 60;

  private final StringRedisTemplate redisTemplate;

  public void checkMessageRate(String userId) {
    check("rate:msg:" + userId, MESSAGE_WINDOW_SECONDS, MAX_MESSAGES);
  }

  public void checkUploadRate(String userId) {
    check("rate:upload:" + userId, UPLOAD_WINDOW_SECONDS, MAX_UPLOADS);
  }

  public void checkReactionRate(String userId) {
    check("rate:reaction:" + userId, REACTION_WINDOW_SECONDS, MAX_REACTIONS);
  }

  private void check(String key, long windowSeconds, int max) {
    Long count = redisTemplate.opsForValue().increment(key);
    if (count != null && count == 1) {
      redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
    }
    if (count != null && count > max) {
      throw new RateLimitExceededException();
    }
  }
}
