package com.platform.chatservice.config;

import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Connection settings for the LiveKit media server that carries calls and meetings. Bound from
 * {@code app.livekit.*}. When url, key or secret is blank LiveKit is off: calls stay on the P2P
 * mesh path and meetings report themselves unavailable.
 *
 * <p>Spec: {@code docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md} §4.1.
 */
@Component
@ConfigurationProperties(prefix = "app.livekit")
@Data
public class LiveKitProperties {

  /** LiveKit refuses shorter secrets outside --dev, and jjwt refuses them for HS256. */
  static final int MIN_SECRET_LENGTH = 32;

  /** wss:// URL handed to clients. */
  private String url;

  /** http(s):// URL of the server API; blank = derived from {@link #url}. */
  private String apiUrl;

  private String apiKey;
  private String apiSecret;

  /** "mesh" (default) or "sfu": the media path for calls. Meetings always use LiveKit. */
  private String callTransport = "mesh";

  private long tokenTtlSeconds = 600;

  public boolean isConfigured() {
    return StringUtils.hasText(url)
        && StringUtils.hasText(apiKey)
        && StringUtils.hasText(apiSecret);
  }

  public boolean callsUseSfu() {
    return "sfu".equalsIgnoreCase(callTransport) && isConfigured();
  }

  public String resolvedApiUrl() {
    if (!isConfigured()) {
      throw new IllegalStateException("LiveKit is not configured");
    }
    String base =
        StringUtils.hasText(apiUrl)
            ? apiUrl
            : url.replaceFirst("^wss://", "https://").replaceFirst("^ws://", "http://");
    return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
  }

  public SecretKey signingKey() {
    if (!StringUtils.hasText(apiSecret) || apiSecret.length() < MIN_SECRET_LENGTH) {
      throw new IllegalStateException(
          "LIVEKIT_API_SECRET must be at least " + MIN_SECRET_LENGTH + " characters");
    }
    return Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8));
  }
}
