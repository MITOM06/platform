package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/** Mark / clear semantics run against real Redis in {@link CallBusyRegistryRedisTest}. */
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
  void busyCallOfReadsTheKey() {
    when(values.get("call:user:u1")).thenReturn("c1");
    assertThat(registry.busyCallOf("u1")).isEqualTo("c1");
    assertThat(registry.busyCallOf("u2")).isNull();
  }

  @Test
  void nullArgumentsAreIgnored() {
    registry.markBusy(null, "c1");
    registry.clear("u1", null);
    verifyNoInteractions(redis);
  }
}
