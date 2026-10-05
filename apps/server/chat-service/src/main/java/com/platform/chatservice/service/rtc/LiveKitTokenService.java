package com.platform.chatservice.service.rtc;

import com.platform.chatservice.config.LiveKitProperties;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Signs LiveKit access tokens. Clients get a short-lived participant token for one room; the room
 * API gets an even shorter server token. Format:
 * https://docs.livekit.io/home/get-started/authentication/
 */
@Service
@RequiredArgsConstructor
public class LiveKitTokenService {

  private static final long SERVER_TOKEN_TTL_SECONDS = 60;

  private final LiveKitProperties props;

  public String participantToken(
      String identity, String displayName, String metadataJson, RtcGrant grant) {
    requireConfigured();
    if (!StringUtils.hasText(identity)) {
      throw new IllegalArgumentException("identity is required");
    }
    JwtBuilder builder =
        base(props.getTokenTtlSeconds()).setSubject(identity).claim("video", grant.toVideoClaim());
    if (StringUtils.hasText(displayName)) {
      builder.claim("name", displayName);
    }
    if (StringUtils.hasText(metadataJson)) {
      builder.claim("metadata", metadataJson);
    }
    return builder.signWith(props.signingKey(), SignatureAlgorithm.HS256).compact();
  }

  /** Token for the server API (Twirp). {@code room} may be null for room-independent calls. */
  public String serverToken(String room) {
    requireConfigured();
    Map<String, Object> video = new LinkedHashMap<>();
    if (room != null) {
      video.put("room", room);
    }
    video.put("roomAdmin", true);
    video.put("roomCreate", true);
    video.put("roomList", true);
    return base(SERVER_TOKEN_TTL_SECONDS)
        .claim("video", video)
        .signWith(props.signingKey(), SignatureAlgorithm.HS256)
        .compact();
  }

  private JwtBuilder base(long ttlSeconds) {
    Instant now = Instant.now();
    return Jwts.builder()
        .setIssuer(props.getApiKey())
        .setId(UUID.randomUUID().toString())
        .setNotBefore(Date.from(now))
        .setExpiration(Date.from(now.plusSeconds(ttlSeconds)));
  }

  private void requireConfigured() {
    if (!props.isConfigured()) {
      throw new LiveKitUnavailableException();
    }
  }
}
