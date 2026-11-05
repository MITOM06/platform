package com.platform.chatservice.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Short-lived, stateless tokens a client puts in {@code ?t=} so {@code <img src>} can load an
 * upload without an Authorization header. Format: {@code base64url(userId.exp) .
 * base64url(HMAC-SHA256(key, payload))}, signed with a key derived from the JWT secret so it can
 * never be replayed as a JWT. {@code exp} is rounded up to a 6h boundary so every token issued in
 * the same window is identical (stable URLs, cache hits).
 */
@Service
public class MediaTokenService {

  public record MediaToken(String token, Instant expiresAt) {}

  private static final String HMAC = "HmacSHA256";
  private static final long WINDOW_SECONDS = Duration.ofHours(6).toSeconds();
  private static final Base64.Encoder ENC = Base64.getUrlEncoder().withoutPadding();
  private static final Base64.Decoder DEC = Base64.getUrlDecoder();

  private final byte[] key;
  private final Clock clock;
  private final Duration ttl;

  public MediaTokenService(
      @Value("${app.jwt.secret}") String jwtSecret,
      @Value("${app.uploads.token-ttl:PT24H}") Duration ttl,
      Clock clock) {
    this.key = hmac(jwtSecret.getBytes(StandardCharsets.UTF_8), "pon-media-v1");
    this.ttl = ttl;
    this.clock = clock;
  }

  public MediaToken issue(String userId) {
    long target = clock.instant().plus(ttl).getEpochSecond();
    long exp = (target / WINDOW_SECONDS + 1) * WINDOW_SECONDS;
    String payload = ENC.encodeToString((userId + "." + exp).getBytes(StandardCharsets.UTF_8));
    String sig = ENC.encodeToString(hmac(key, payload));
    return new MediaToken(payload + "." + sig, Instant.ofEpochSecond(exp));
  }

  /** The userId the token was issued to, or empty when malformed, forged or expired. */
  public Optional<String> verify(String token) {
    if (token == null) return Optional.empty();
    int dot = token.indexOf('.');
    if (dot <= 0 || dot == token.length() - 1) return Optional.empty();
    String payload = token.substring(0, dot);
    byte[] given;
    try {
      given = DEC.decode(token.substring(dot + 1));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
    if (!MessageDigest.isEqual(hmac(key, payload), given)) return Optional.empty();
    try {
      String decoded = new String(DEC.decode(payload), StandardCharsets.UTF_8);
      int sep = decoded.lastIndexOf('.');
      if (sep <= 0) return Optional.empty();
      long exp = Long.parseLong(decoded.substring(sep + 1));
      if (clock.instant().getEpochSecond() >= exp) return Optional.empty();
      return Optional.of(decoded.substring(0, sep));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  private static byte[] hmac(byte[] k, String data) {
    try {
      Mac mac = Mac.getInstance(HMAC);
      mac.init(new SecretKeySpec(k, HMAC));
      return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }
}
