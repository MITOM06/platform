package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The busy registry against a real Redis: its compare-and-delete and the meeting guard are Lua
 * scripts, which a mocked template cannot exercise.
 */
@Testcontainers
class CallBusyRegistryRedisTest {

  @Container
  static GenericContainer<?> redisContainer =
      new GenericContainer<>("redis:7").withExposedPorts(6379);

  private static LettuceConnectionFactory factory;
  private static StringRedisTemplate redis;
  private CallBusyRegistry registry;

  @BeforeAll
  static void connect() {
    factory =
        new LettuceConnectionFactory(
            new RedisStandaloneConfiguration(
                redisContainer.getHost(), redisContainer.getMappedPort(6379)));
    factory.afterPropertiesSet();
    redis = new StringRedisTemplate(factory);
    redis.afterPropertiesSet();
  }

  @AfterAll
  static void close() {
    factory.destroy();
  }

  @BeforeEach
  void setUp() {
    redis.delete(redis.keys("call:user:*"));
    registry = new CallBusyRegistry(redis);
  }

  @Test
  void clearOnlyDropsTheCallItWasAskedAbout() {
    registry.markBusy("u1", "call-a");

    registry.clear("u1", "call-b");
    assertThat(registry.busyCallOf("u1")).isEqualTo("call-a");

    registry.clear("u1", "call-a");
    assertThat(registry.busyCallOf("u1")).isNull();
  }

  @Test
  void markingBusyKeepsTheSixHourSafetyTtl() {
    registry.markBusy("u1", "call-a");

    assertThat(redis.getExpire("call:user:u1")).isBetween(6 * 3600L - 5, 6 * 3600L);
  }

  /**
   * Someone in a meeting who places a call: the call must not take over the meeting's entry,
   * otherwise ending the call cleared it and they looked free while still in the meeting.
   */
  @Test
  void aCallDoesNotTakeOverAMeetingEntry() {
    registry.markBusy("u1", "meet_m1");

    registry.markBusy("u1", "call-a");
    assertThat(registry.busyCallOf("u1")).isEqualTo("meet_m1");

    registry.clear("u1", "call-a");
    assertThat(registry.busyCallOf("u1")).isEqualTo("meet_m1");
  }

  @Test
  void aMeetingStillReplacesACallEntry() {
    registry.markBusy("u1", "call-a");

    registry.markBusy("u1", "meet_m1");

    assertThat(registry.busyCallOf("u1")).isEqualTo("meet_m1");
  }
}
