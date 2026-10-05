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
    verify(hash).multiGet("sess:s1", List.<Object>of("userId", "revoked", "claimsAt"));
  }

  // ---------------------------------------------------------------- F1 claimsAt

  private void sessionWithClaimsAt(String sid, String userId, String revoked, String claimsAt) {
    when(hash.multiGet(eq("sess:" + sid), anyCollection()))
        .thenReturn(Arrays.<Object>asList(userId, revoked, claimsAt));
  }

  @Test
  void tokenIssuedBeforeClaimsAtIsStale() {
    sessionWithClaimsAt("s1", "u1", "0", "1700000100");
    assertThat(validator.validateToken("s1", "u1", 1_700_000_099L))
        .isEqualTo(SessionStatus.TOKEN_CLAIMS_STALE);
    assertThat(SessionStatus.TOKEN_CLAIMS_STALE.code()).isEqualTo("TOKEN_CLAIMS_STALE");
  }

  @Test
  void tokenIssuedAtOrAfterClaimsAtIsValid_strictLessThan() {
    sessionWithClaimsAt("s1", "u1", "0", "1700000100");
    assertThat(validator.validateToken("s1", "u1", 1_700_000_100L)).isEqualTo(SessionStatus.VALID);
    assertThat(validator.validateToken("s1", "u1", 1_700_000_500L)).isEqualTo(SessionStatus.VALID);
  }

  @Test
  void noClaimsAtMeansNoIatCheck() {
    session("s1", "u1", "0");
    assertThat(validator.validateToken("s1", "u1", 1L)).isEqualTo(SessionStatus.VALID);
    assertThat(validator.validateToken("s1", "u1", null)).isEqualTo(SessionStatus.VALID);
  }

  @Test
  void tokenWithoutIatIsStaleOnceClaimsChanged() {
    sessionWithClaimsAt("s1", "u1", "0", "1700000100");
    assertThat(validator.validateToken("s1", "u1", null))
        .isEqualTo(SessionStatus.TOKEN_CLAIMS_STALE);
  }

  @Test
  void openSocketCheckIgnoresClaimsAt() {
    sessionWithClaimsAt("s1", "u1", "0", "1700000100");
    assertThat(validator.validate("s1", "u1")).isEqualTo(SessionStatus.VALID);
  }

  @Test
  void revocationWinsOverStaleClaims() {
    sessionWithClaimsAt("s1", "u1", "1", "1700000100");
    assertThat(validator.validateToken("s1", "u1", 1L)).isEqualTo(SessionStatus.SESSION_REVOKED);
  }

  @Test
  void claimsAtIsCachedAndEvictUserRereadsIt() {
    sessionWithClaimsAt("s1", "u1", "0", null);
    assertThat(validator.validateToken("s1", "u1", 1_700_000_000L)).isEqualTo(SessionStatus.VALID);
    sessionWithClaimsAt("s1", "u1", "0", "1700000100"); // role changed in auth-service
    assertThat(validator.validateToken("s1", "u1", 1_700_000_000L))
        .isEqualTo(SessionStatus.VALID); // still the cached snapshot
    validator.evictUser("u1"); // auth:claims-changed
    assertThat(validator.validateToken("s1", "u1", 1_700_000_000L))
        .isEqualTo(SessionStatus.TOKEN_CLAIMS_STALE);
  }

  @Test
  void parsesClaimsAtLeniently() {
    assertThat(SessionValidator.parseEpochSeconds("1700000100")).isEqualTo(1_700_000_100L);
    assertThat(SessionValidator.parseEpochSeconds(" 1700000100.9 ")).isEqualTo(1_700_000_100L);
    assertThat(SessionValidator.parseEpochSeconds("garbage")).isNull();
    assertThat(SessionValidator.parseEpochSeconds(null)).isNull();
  }
}
