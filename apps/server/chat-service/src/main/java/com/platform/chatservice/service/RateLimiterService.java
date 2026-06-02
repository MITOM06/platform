package com.platform.chatservice.service;

import com.platform.chatservice.exception.RateLimitExceededException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Fixed-window rate limiter backed by Redis.
 * Allows at most MAX_MESSAGES per WINDOW_SECONDS per user.
 */
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private static final int MAX_MESSAGES = 10;
    private static final long WINDOW_SECONDS = 5;

    private final StringRedisTemplate redisTemplate;

    /**
     * Increments the user's message counter and throws {@link RateLimitExceededException}
     * if the limit is exceeded. The counter key expires automatically after WINDOW_SECONDS.
     */
    public void checkMessageRate(String userId) {
        String key = "rate:msg:" + userId;
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(WINDOW_SECONDS));
        }
        if (count != null && count > MAX_MESSAGES) {
            throw new RateLimitExceededException();
        }
    }
}
