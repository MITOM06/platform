package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class CallBusyRegistryTest {

  private StringRedisTemplate redis;
  private ValueOperations<String, String> values;
  private CallBusyRegistry registry;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    values = mock(ValueOperations.class);
    when(redis.opsForValue()).thenReturn(values);
    registry = new CallBusyRegistry(redis);
  }

  @Test
  void markBusyStoresTheCallWithASixHourTtl() {
    registry.markBusy("u1", "c1");
    verify(values).set("call:user:u1", "c1", Duration.ofHours(6));
  }

  @Test
  void busyCallOfReadsTheKey() {
    when(values.get("call:user:u1")).thenReturn("c1");
    assertThat(registry.busyCallOf("u1")).isEqualTo("c1");
    assertThat(registry.busyCallOf("u2")).isNull();
  }

  @Test
  void clearOnlyRemovesTheSameCall() {
    when(values.get("call:user:u1")).thenReturn("c-other");
    registry.clear("u1", "c1");
    verify(redis, never()).delete(anyString());

    when(values.get("call:user:u1")).thenReturn("c1");
    registry.clear("u1", "c1");
    verify(redis).delete("call:user:u1");
  }

  @Test
  void nullArgumentsAreIgnored() {
    registry.markBusy(null, "c1");
    registry.clear("u1", null);
    verify(values, never()).set(anyString(), anyString(), org.mockito.ArgumentMatchers.any());
    verify(redis, never()).delete(anyString());
  }
}
