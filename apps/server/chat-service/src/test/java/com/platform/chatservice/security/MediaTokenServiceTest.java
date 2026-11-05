package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class MediaTokenServiceTest {

  private static final String SECRET = "test-secret-test-secret-test-secret-0123456789";
  private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

  private MediaTokenService at(Instant now) {
    return new MediaTokenService(SECRET, Duration.ofHours(24), Clock.fixed(now, ZoneOffset.UTC));
  }

  @Test
  void issue_then_verify_returns_userId() {
    MediaTokenService svc = at(NOW);
    var issued = svc.issue("user-1");
    assertThat(svc.verify(issued.token())).contains("user-1");
    assertThat(issued.expiresAt()).isAfter(NOW.plus(Duration.ofHours(24)));
  }

  @Test
  void verify_rejects_tampered_signature() {
    MediaTokenService svc = at(NOW);
    String token = svc.issue("user-1").token();
    char last = token.charAt(token.length() - 1);
    String tampered = token.substring(0, token.length() - 1) + (last == 'A' ? 'B' : 'A');
    assertThat(svc.verify(tampered)).isEmpty();
  }

  @Test
  void verify_rejects_expired() {
    var issued = at(NOW).issue("user-1");
    assertThat(at(issued.expiresAt().plusSeconds(1)).verify(issued.token())).isEmpty();
  }

  @Test
  void same_window_issues_identical_token() {
    // 24h ttl lands at 10:00 next day; both instants round up to the same 6h boundary (12:00)
    assertThat(at(NOW).issue("user-1").token())
        .isEqualTo(at(NOW.plusSeconds(60)).issue("user-1").token());
  }

  @Test
  void media_token_is_not_accepted_as_jwt() {
    String token = at(NOW).issue("user-1").token();
    assertThat(new JwtUtil(SECRET).isValid(token)).isFalse();
    // sanity: JwtUtil does accept a real JWT with the same secret
    String jwt =
        Jwts.builder()
            .setSubject("user-1")
            .signWith(
                Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                SignatureAlgorithm.HS256)
            .compact();
    assertThat(new JwtUtil(SECRET).isValid(jwt)).isTrue();
  }
}
