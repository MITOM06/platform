package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;

/** Cluster presence: online while ANY socket lives, offline + last-seen only on the last one. */
class PresenceServiceTest {

  private static final String U = "u1";

  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);

  @SuppressWarnings("unchecked")
  private final ZSetOperations<String, String> zset = mock(ZSetOperations.class);

  @SuppressWarnings("unchecked")
  private final ValueOperations<String, String> values = mock(ValueOperations.class);

  private final AtomicLong now = new AtomicLong(10_000_000);
  private final PresenceService presence = new PresenceService(redis, now::get);

  @BeforeEach
  void wire() {
    when(redis.opsForZSet()).thenReturn(zset);
    when(redis.opsForValue()).thenReturn(values);
  }

  @Test
  void connectRecordsSocketAndMarksOnline() {
    presence.connected(U, "s1");
    verify(zset).add("user:sockets:u1", "s1", 10_000_000d);
    verify(redis).expire("user:sockets:u1", Duration.ofMinutes(10));
    verify(values).set("user:status:u1", "online", PresenceService.ONLINE_TTL);
  }

  @Test
  void nullIdsAreIgnored() {
    presence.connected(null, "s1");
    presence.connected(U, null);
    presence.touch(null, "s1");
    presence.touch(U, null);
    assertThat(presence.disconnected(null, "s1")).isFalse();
    verifyNoInteractions(redis);
  }

  @Test
  void touchIsThrottledPerSocket() {
    presence.connected(U, "s1");
    now.addAndGet(PresenceService.TOUCH_INTERVAL.toMillis() - 1);
    presence.touch(U, "s1");
    verify(zset, times(1)).add(anyString(), anyString(), anyDouble());

    now.addAndGet(1);
    presence.touch(U, "s1");
    verify(zset, times(2)).add(anyString(), anyString(), anyDouble());

    // A first touch on an unknown socket refreshes immediately.
    presence.touch(U, "s2");
    verify(zset).add("user:sockets:u1", "s2", (double) now.get());
  }

  @Test
  void redisFailureOnConnectOrTouchIsSwallowed() {
    doThrow(new RuntimeException("down")).when(zset).add(anyString(), anyString(), anyDouble());
    presence.connected(U, "s1");
    presence.touch(U, "s9");
    verify(values, never()).set(anyString(), anyString(), any(Duration.class));
  }

  @Test
  void disconnectWithOtherSocketAliveStaysOnline() {
    when(zset.zCard("user:sockets:u1")).thenReturn(1L);
    assertThat(presence.disconnected(U, "s1")).isFalse();
    verify(zset).remove("user:sockets:u1", "s1");
    verify(zset)
        .removeRangeByScore(
            "user:sockets:u1", 0, 10_000_000 - PresenceService.ONLINE_TTL.toMillis());
    verify(redis, never()).delete(anyString());
  }

  @Test
  void lastSocketGoingAwayMarksOfflineAndStampsLastSeen() {
    when(zset.zCard("user:sockets:u1")).thenReturn(0L);
    assertThat(presence.disconnected(U, "s1")).isTrue();
    verify(redis).delete("user:status:u1");
    verify(values).set("user:lastseen:u1", "10000000");
  }

  @Test
  void disconnectWithoutSessionIdStillPrunesAndCounts() {
    when(zset.zCard("user:sockets:u1")).thenReturn(null);
    assertThat(presence.disconnected(U, null)).isTrue();
    verify(zset, never()).remove(anyString(), any());
  }

  @Test
  void disconnectRedisFailureDoesNotClaimOffline() {
    when(zset.zCard(anyString())).thenThrow(new RuntimeException("down"));
    assertThat(presence.disconnected(U, "s1")).isFalse();
    verify(redis, never()).delete(anyString());
  }

  @Test
  void disconnectResetsThrottleSoReconnectTouchRefreshes() {
    when(zset.zCard(anyString())).thenReturn(0L);
    presence.connected(U, "s1");
    presence.disconnected(U, "s1");
    presence.touch(U, "s1");
    verify(zset, times(2)).add(eq("user:sockets:u1"), eq("s1"), anyDouble());
  }
}
