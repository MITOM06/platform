package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LiveKitWebhookVerifierTest {

  private static final String SECRET = "0123456789abcdef0123456789abcdef";
  private static final String BODY =
      "{\"event\":\"participant_joined\",\"room\":{\"name\":\"call_abc\"},"
          + "\"participant\":{\"identity\":\"user-1\"}}";

  private LiveKitProperties props;
  private LiveKitWebhookVerifier verifier;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret(SECRET);
    verifier = new LiveKitWebhookVerifier(props);
  }

  private static String sha256(String body) throws Exception {
    byte[] digest =
        MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(digest);
  }

  /** What LiveKit sends: a token signed with the API secret, carrying the body hash. */
  private static String signed(String issuer, String secret, String hash, long ttlSeconds) {
    Instant now = Instant.now();
    return Jwts.builder()
        .setIssuer(issuer)
        .setNotBefore(Date.from(now.minusSeconds(5)))
        .setExpiration(Date.from(now.plusSeconds(ttlSeconds)))
        .claim("sha256", hash)
        .signWith(
            Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
        .compact();
  }

  @Test
  void acceptsAGenuineWebhook() throws Exception {
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), 60), BODY)).isTrue();
  }

  @Test
  void acceptsABearerPrefix() throws Exception {
    assertThat(verifier.verify("Bearer " + signed("APIkey1", SECRET, sha256(BODY), 60), BODY))
        .isTrue();
  }

  @Test
  void rejectsATamperedBody() throws Exception {
    String header = signed("APIkey1", SECRET, sha256(BODY), 60);
    assertThat(verifier.verify(header, BODY.replace("user-1", "user-2"))).isFalse();
  }

  @Test
  void rejectsAnotherIssuer() throws Exception {
    assertThat(verifier.verify(signed("otherKey", SECRET, sha256(BODY), 60), BODY)).isFalse();
  }

  @Test
  void rejectsAnotherSecret() throws Exception {
    String other = "ffffffffffffffffffffffffffffffff";
    assertThat(verifier.verify(signed("APIkey1", other, sha256(BODY), 60), BODY)).isFalse();
  }

  @Test
  void rejectsAnExpiredToken() throws Exception {
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), -10), BODY)).isFalse();
  }

  @Test
  void rejectsMissingHeaderOrBody() throws Exception {
    assertThat(verifier.verify(null, BODY)).isFalse();
    assertThat(verifier.verify("", BODY)).isFalse();
    assertThat(verifier.verify(signed("APIkey1", SECRET, sha256(BODY), 60), null)).isFalse();
  }

  @Test
  void rejectsEverythingWhenLiveKitIsOff() throws Exception {
    String header = signed("APIkey1", SECRET, sha256(BODY), 60);
    props.setUrl("");
    assertThat(verifier.verify(header, BODY)).isFalse();
  }
}
