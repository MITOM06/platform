package com.platform.chatservice.security;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Enforces the auth-service session contract on chat-service: an access token is honoured only if
 * {@code sess:{sid}} exists, its {@code userId} equals the token {@code sub}, and {@code revoked !=
 * '1'} (same rule as auth-service {@code jwt.strategy.ts}).
 *
 * <p>The raw session snapshot ({@code userId}, {@code revoked}) is cached in memory per {@code sid}
 * for at most {@code app.session.cache-ttl-ms} (default and maximum 5s) to keep Redis load flat
 * under chatty STOMP traffic. A revocation event ({@link #evictUser}) drops the user's entries
 * immediately. Redis failures are never cached and surface as {@link SessionStatus#UNAVAILABLE}.
 */
@Component
@Slf4j
public class SessionValidator {

  static final String SESSION_KEY_PREFIX = "sess:";
  private static final long MAX_CACHE_TTL_MS = 5_000;
  private static final int PURGE_THRESHOLD = 10_000;

  private final StringRedisTemplate redisTemplate;
  private final long cacheTtlMs;
  private final LongSupplier clock;
  private final Map<String, Snapshot> cache = new ConcurrentHashMap<>();

  /** Session hash fields that matter here; {@code userId == null} means "not found". */
  private record Snapshot(String userId, boolean revoked, long expiresAt) {}

  @Autowired
  public SessionValidator(
      StringRedisTemplate redisTemplate, @Value("${app.session.cache-ttl-ms:5000}") long ttlMs) {
    this(redisTemplate, ttlMs, System::currentTimeMillis);
  }

  SessionValidator(StringRedisTemplate redisTemplate, long ttlMs, LongSupplier clock) {
    this.redisTemplate = redisTemplate;
    this.cacheTtlMs = Math.max(0, Math.min(ttlMs, MAX_CACHE_TTL_MS));
    this.clock = clock;
  }

  /** Validate a token's {@code sid} for the token subject {@code userId}. Never throws. */
  public SessionStatus validate(String sid, String userId) {
    if (!StringUtils.hasText(sid) || !StringUtils.hasText(userId)) {
      return SessionStatus.TOKEN_INVALID;
    }
    Snapshot snap;
    try {
      snap = load(sid);
    } catch (RuntimeException e) {
      log.warn("Session store unreachable while validating a session: {}", e.toString());
      return SessionStatus.UNAVAILABLE;
    }
    if (snap.userId() == null) {
      return SessionStatus.SESSION_NOT_FOUND;
    }
    if (snap.revoked()) {
      return SessionStatus.SESSION_REVOKED;
    }
    if (!snap.userId().equals(userId)) {
      return SessionStatus.TOKEN_SESSION_MISMATCH;
    }
    return SessionStatus.VALID;
  }

  /** Forget every cached session of {@code userId} so the next check hits Redis. */
  public void evictUser(String userId) {
    if (userId == null) return;
    cache.values().removeIf(s -> userId.equals(s.userId()));
  }

  private Snapshot load(String sid) {
    long now = clock.getAsLong();
    Snapshot cached = cache.get(sid);
    if (cached != null && cached.expiresAt() > now) {
      return cached;
    }
    HashOperations<String, Object, Object> hash = redisTemplate.opsForHash();
    List<Object> values =
        hash.multiGet(SESSION_KEY_PREFIX + sid, List.<Object>of("userId", "revoked"));
    String owner = values == null || values.isEmpty() ? null : asText(values.get(0));
    String revoked = values == null || values.size() < 2 ? null : asText(values.get(1));
    Snapshot fresh = new Snapshot(owner, "1".equals(revoked), now + cacheTtlMs);
    if (cacheTtlMs > 0) {
      if (cache.size() > PURGE_THRESHOLD) {
        cache.values().removeIf(s -> s.expiresAt() <= now);
      }
      cache.put(sid, fresh);
    }
    return fresh;
  }

  private static String asText(Object value) {
    if (value == null) return null;
    String s = value.toString();
    return s.isEmpty() ? null : s;
  }
}
