package com.platform.chatservice.service;

import com.platform.chatservice.exception.RateLimitExceededException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
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

  private static final int MAX_LINK_PREVIEWS = 60;
  private static final long LINK_PREVIEW_WINDOW_SECONDS = 60;

  /**
   * INCR + EXPIRE as ONE atomic step. Done as two commands, a crash (or connection drop) between
   * them left a counter with no TTL — that user was then rate-limited forever. The TTL check also
   * repairs any such key left behind by the old code.
   */
  static final RedisScript<Long> INCREMENT_WITH_WINDOW =
      new DefaultRedisScript<>(
          "local c = redis.call('INCR', KEYS[1]) "
              + "if c == 1 or redis.call('TTL', KEYS[1]) < 0 then "
              + "redis.call('EXPIRE', KEYS[1], ARGV[1]) end "
              + "return c",
          Long.class);

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

  /** Each preview is an outbound HTTP fetch made on the user's behalf. */
  public void checkLinkPreviewRate(String userId) {
    check("rate:linkpreview:" + userId, LINK_PREVIEW_WINDOW_SECONDS, MAX_LINK_PREVIEWS);
  }

  private void check(String key, long windowSeconds, int max) {
    Long count =
        redisTemplate.execute(INCREMENT_WITH_WINDOW, List.of(key), String.valueOf(windowSeconds));
    if (count != null && count > max) {
      throw new RateLimitExceededException();
    }
  }
}
