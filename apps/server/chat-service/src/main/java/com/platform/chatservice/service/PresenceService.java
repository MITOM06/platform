package com.platform.chatservice.service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Online/offline presence, cluster-wide.
 *
 * <ul>
 *   <li>{@code user:status:{userId}} = "online" with a {@link #ONLINE_TTL} expiry — read by {@code
 *       UserStatusController}, {@code FcmService} (no push while online) and auth-service.
 *   <li>{@code user:sockets:{userId}} — sorted set of the user's open STOMP sessions (score = last
 *       activity in epoch ms). A user is only marked offline when the LAST socket closes, so
 *       closing one tab / device no longer flips everyone else to "offline".
 * </ul>
 *
 * <p>Any inbound frame — including STOMP heartbeats — refreshes both keys ({@link #touch}),
 * throttled to once per {@link #TOUCH_INTERVAL} per socket so a chatty client costs at most one
 * Redis round trip a minute. Sockets whose score is older than {@link #ONLINE_TTL} (an instance
 * that crashed without firing disconnect events) are pruned when counting.
 *
 * <p>Deliberately Redis-only (no broker dependency): it is used by the inbound STOMP interceptor,
 * which is wired into the WebSocket configuration itself, so depending on the messaging template
 * here would create a bean cycle. The online/offline broadcast lives in {@code
 * PresenceEventListener}.
 */
@Service
@Slf4j
public class PresenceService {

  static final String STATUS_KEY_PREFIX = "user:status:";
  static final String SOCKETS_KEY_PREFIX = "user:sockets:";
  static final String LAST_SEEN_KEY_PREFIX = "user:lastseen:";
  static final Duration ONLINE_TTL = Duration.ofMinutes(5);
  static final Duration TOUCH_INTERVAL = Duration.ofSeconds(60);
  private static final Duration SOCKETS_KEY_TTL = Duration.ofMinutes(10);
  private static final int PURGE_THRESHOLD = 20_000;

  private final StringRedisTemplate redisTemplate;
  private final LongSupplier clock;

  /** Last refresh per STOMP session id (local throttle). */
  private final Map<String, Long> lastTouch = new ConcurrentHashMap<>();

  @Autowired
  public PresenceService(StringRedisTemplate redisTemplate) {
    this(redisTemplate, System::currentTimeMillis);
  }

  PresenceService(StringRedisTemplate redisTemplate, LongSupplier clock) {
    this.redisTemplate = redisTemplate;
    this.clock = clock;
  }

  /** A STOMP session finished CONNECT: record it and mark the user online. */
  public void connected(String userId, String sessionId) {
    if (userId == null || sessionId == null) return;
    long now = clock.getAsLong();
    lastTouch.put(sessionId, now);
    try {
      markActive(userId, sessionId, now);
    } catch (RuntimeException e) {
      log.warn("Presence connect update failed for {}: {}", userId, e.toString());
    }
  }

  /** Any inbound frame on a live session (SEND, SUBSCRIBE, heartbeat, …). Throttled. */
  public void touch(String userId, String sessionId) {
    if (userId == null || sessionId == null) return;
    long now = clock.getAsLong();
    Long previous = lastTouch.get(sessionId);
    if (previous != null && now - previous < TOUCH_INTERVAL.toMillis()) {
      return;
    }
    lastTouch.put(sessionId, now);
    if (lastTouch.size() > PURGE_THRESHOLD) {
      long cutoff = now - ONLINE_TTL.toMillis();
      lastTouch.values().removeIf(t -> t < cutoff);
    }
    try {
      markActive(userId, sessionId, now);
    } catch (RuntimeException e) {
      log.debug("Presence refresh failed for {}: {}", userId, e.toString());
    }
  }

  /**
   * A STOMP session ended. Only when it was the user's last live socket is the presence key removed
   * and last-seen stamped. Idempotent (Spring may fire the disconnect event twice).
   *
   * @return true iff the user just went offline (no live socket left anywhere in the cluster)
   */
  public boolean disconnected(String userId, String sessionId) {
    if (userId == null) return false;
    if (sessionId != null) {
      lastTouch.remove(sessionId);
    }
    long now = clock.getAsLong();
    String socketsKey = SOCKETS_KEY_PREFIX + userId;
    try {
      if (sessionId != null) {
        redisTemplate.opsForZSet().remove(socketsKey, sessionId);
      }
      redisTemplate.opsForZSet().removeRangeByScore(socketsKey, 0, now - ONLINE_TTL.toMillis());
      Long remaining = redisTemplate.opsForZSet().zCard(socketsKey);
      if (remaining != null && remaining > 0) {
        return false; // another tab/device of this user is still connected
      }
      redisTemplate.delete(STATUS_KEY_PREFIX + userId);
      redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));
      return true;
    } catch (RuntimeException e) {
      log.warn("Presence disconnect update failed for {}: {}", userId, e.toString());
      return false;
    }
  }

  private void markActive(String userId, String sessionId, long now) {
    String socketsKey = SOCKETS_KEY_PREFIX + userId;
    redisTemplate.opsForZSet().add(socketsKey, sessionId, now);
    redisTemplate.expire(socketsKey, SOCKETS_KEY_TTL);
    // set() (not expire()) so a still-alive socket whose key already lapsed re-creates it.
    redisTemplate.opsForValue().set(STATUS_KEY_PREFIX + userId, "online", ONLINE_TTL);
  }
}
