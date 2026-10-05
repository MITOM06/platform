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
 * <p>A NEW authentication (a REST request, a STOMP CONNECT) additionally goes through {@link
 * #validateToken}: when the session carries {@code claimsAt} (unix seconds, written by auth-service
 * {@code SessionService.markClaimsStale} after the user's role / departments / permissions changed)
 * a token with {@code iat < claimsAt} is {@link SessionStatus#TOKEN_CLAIMS_STALE} — the client
 * refreshes and retries with the fresh claims instead of being logged out. Frames on an
 * already-open socket keep using {@link #validate} (only {@code revoked} matters there).
 *
 * <p>The raw session snapshot ({@code userId}, {@code revoked}, {@code claimsAt}) is cached in
 * memory per {@code sid} for at most {@code app.session.cache-ttl-ms} (default and maximum 5s) to
 * keep Redis load flat under chatty STOMP traffic. A revocation / claims-changed event ({@link
 * #evictUser}) drops the user's entries immediately. Redis failures are never cached and surface as
 * {@link SessionStatus#UNAVAILABLE}.
 */
@Component
@Slf4j
public class SessionValidator {

  static final String SESSION_KEY_PREFIX = "sess:";
  static final List<Object> SESSION_FIELDS = List.of("userId", "revoked", "claimsAt");
  private static final long MAX_CACHE_TTL_MS = 5_000;
  private static final int PURGE_THRESHOLD = 10_000;

  private final StringRedisTemplate redisTemplate;
  private final long cacheTtlMs;
  private final LongSupplier clock;
  private final Map<String, Snapshot> cache = new ConcurrentHashMap<>();

  /**
   * Session hash fields that matter here; {@code userId == null} means "not found", {@code claimsAt
   * == null} means "claims never changed" (no iat check).
   */
  private record Snapshot(String userId, boolean revoked, Long claimsAt, long expiresAt) {}

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

  /**
   * Validate a token's {@code sid} for the token subject {@code userId} WITHOUT the
   * claims-freshness check — for frames on an already-authenticated socket and the periodic socket
   * sweep. Never throws.
   */
  public SessionStatus validate(String sid, String userId) {
    return check(sid, userId, false, null);
  }

  /**
   * Full check for a new authentication (REST request, STOMP CONNECT): {@link #validate} plus
   * {@code iat >= claimsAt} when the session has a {@code claimsAt} (strict {@code <} is stale; a
   * token without {@code iat} cannot prove it is fresh, so it is stale too). Never throws.
   */
  public SessionStatus validateToken(String sid, String userId, Long issuedAtSeconds) {
    return check(sid, userId, true, issuedAtSeconds);
  }

  private SessionStatus check(String sid, String userId, boolean checkClaims, Long iat) {
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
    if (checkClaims && snap.claimsAt() != null && (iat == null || iat < snap.claimsAt())) {
      return SessionStatus.TOKEN_CLAIMS_STALE;
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
    List<Object> values = hash.multiGet(SESSION_KEY_PREFIX + sid, SESSION_FIELDS);
    String owner = field(values, 0);
    String revoked = field(values, 1);
    Long claimsAt = parseEpochSeconds(field(values, 2));
    Snapshot fresh = new Snapshot(owner, "1".equals(revoked), claimsAt, now + cacheTtlMs);
    if (cacheTtlMs > 0) {
      if (cache.size() > PURGE_THRESHOLD) {
        cache.values().removeIf(s -> s.expiresAt() <= now);
      }
      cache.put(sid, fresh);
    }
    return fresh;
  }

  private static String field(List<Object> values, int index) {
    return values == null || values.size() <= index ? null : asText(values.get(index));
  }

  /**
   * {@code claimsAt} is written as integer unix seconds; a fractional value is floored. Anything
   * unparseable is treated as absent (logged) rather than locking every token of the session out.
   */
  static Long parseEpochSeconds(String raw) {
    if (raw == null) return null;
    try {
      return Long.parseLong(raw.trim());
    } catch (NumberFormatException notInteger) {
      try {
        double value = Double.parseDouble(raw.trim());
        return Double.isFinite(value) ? (long) Math.floor(value) : null;
      } catch (NumberFormatException e) {
        log.warn("Ignoring unparseable session claimsAt '{}'", raw);
        return null;
      }
    }
  }

  private static String asText(Object value) {
    if (value == null) return null;
    String s = value.toString();
    return s.isEmpty() ? null : s;
  }
}
