package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

@SuppressWarnings({"unchecked", "rawtypes", "null"})
class SessionValidatorTest {

  private StringRedisTemplate redis;
  private HashOperations<String, Object, Object> hash;
  private final AtomicLong now = new AtomicLong(1_000_000);
  private SessionValidator validator;

  @BeforeEach
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    hash = mock(HashOperations.class);
    when(redis.opsForHash()).thenReturn((HashOperations) hash);
    validator = new SessionValidator(redis, 5_000, now::get);
  }

  private void session(String sid, String userId, String revoked) {
    when(hash.multiGet(eq("sess:" + sid), anyCollection()))
        .thenReturn(Arrays.<Object>asList(userId, revoked));
  }

  @Test
  void validSession() {
    session("s1", "u1", "0");
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.VALID);
  }

  @Test
  void revokedSession() {
    session("s1", "u1", "1");
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.SESSION_REVOKED);
  }

  @Test
  void missingSession() {
    session("s1", null, null);
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.SESSION_NOT_FOUND);
  }

  @Test
  void sessionOfAnotherUser() {
    session("s1", "someone-else", "0");
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.TOKEN_SESSION_MISMATCH);
  }

  @Test
  void tokenWithoutSidIsInvalidWithoutTouchingRedis() {
    assertThat(validator.validate(null, "u1")).isEqualTo(SessionStatus.TOKEN_INVALID);
    assertThat(validator.validate("", "u1")).isEqualTo(SessionStatus.TOKEN_INVALID);
    verify(hash, never()).multiGet(anyString(), anyCollection());
  }

  @Test
  void redisDownIsUnavailableNotRevoked() {
    when(hash.multiGet(anyString(), anyCollection()))
        .thenThrow(new RedisConnectionFailureException("down"));
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.UNAVAILABLE);
    assertThat(SessionStatus.UNAVAILABLE.code()).isEqualTo("SESSION_CHECK_UNAVAILABLE");
  }

  @Test
  void cachesForAtMostTtlThenRereads() {
    session("s1", "u1", "0");
    validator.validate("s1", "u1");
    validator.validate("s1", "u1");
    verify(hash, times(1)).multiGet(eq("sess:s1"), anyCollection());

    session("s1", "u1", "1"); // revoked in Redis
    now.addAndGet(4_000);
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.VALID); // still cached
    now.addAndGet(1_001);
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.SESSION_REVOKED);
  }

  @Test
  void ttlIsCappedAtFiveSeconds() {
    validator = new SessionValidator(redis, 60_000, now::get);
    session("s1", "u1", "0");
    validator.validate("s1", "u1");
    now.addAndGet(5_001);
    validator.validate("s1", "u1");
    verify(hash, times(2)).multiGet(eq("sess:s1"), anyCollection());
  }

  @Test
  void evictUserForcesImmediateReread() {
    session("s1", "u1", "0");
    validator.validate("s1", "u1");
    session("s1", "u1", "1");
    validator.evictUser("u1");
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.SESSION_REVOKED);
  }

  @Test
  void requestsOnlyTheNeededFields() {
    session("s1", "u1", "0");
    validator.validate("s1", "u1");
    verify(hash).multiGet("sess:s1", List.<Object>of("userId", "revoked"));
  }
}
