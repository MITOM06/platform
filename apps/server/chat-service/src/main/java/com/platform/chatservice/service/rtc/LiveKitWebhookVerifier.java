package com.platform.chatservice.service.rtc;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Checks that a webhook really came from our LiveKit server: the Authorization header is a token
 * signed with our API secret, issued by our API key, and its {@code sha256} claim matches the body.
 */
@Component
@RequiredArgsConstructor
public class LiveKitWebhookVerifier {

  private final LiveKitProperties props;

  public boolean verify(String authorizationHeader, String body) {
    if (!props.isConfigured() || !StringUtils.hasText(authorizationHeader) || body == null) {
      return false;
    }
    String token =
        authorizationHeader.startsWith("Bearer ")
            ? authorizationHeader.substring("Bearer ".length())
            : authorizationHeader;
    try {
      Claims claims =
          Jwts.parserBuilder()
              .setSigningKey(props.signingKey())
              .build()
              .parseClaimsJws(token)
              .getBody();
      if (!props.getApiKey().equals(claims.getIssuer())) {
        return false;
      }
      Object claimed = claims.get("sha256");
      if (claimed == null) {
        return false;
      }
      return MessageDigest.isEqual(
          sha256Base64(body).getBytes(StandardCharsets.UTF_8),
          claimed.toString().getBytes(StandardCharsets.UTF_8));
    } catch (JwtException | IllegalArgumentException e) {
      return false;
    }
  }

  private static String sha256Base64(String body) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
