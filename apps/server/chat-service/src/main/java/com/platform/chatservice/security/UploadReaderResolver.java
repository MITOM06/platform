package com.platform.chatservice.security;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Works out who is reading an upload: a valid media token ({@code ?t=}), the internal service key,
 * or an authenticated JWT session (already validated by {@link JwtAuthenticationFilter}).
 */
@Component
@RequiredArgsConstructor
public class UploadReaderResolver {

  public static final String INTERNAL_READER = "__internal__";

  private final MediaTokenService mediaTokenService;

  @Value("${app.connector.internal-key:}")
  private String internalKey;

  /** userId, {@link #INTERNAL_READER}, or empty when the request carries no valid credential. */
  public Optional<String> resolve(HttpServletRequest req) {
    String t = req.getParameter("t");
    if (t != null && !t.isEmpty()) {
      Optional<String> userId = mediaTokenService.verify(t);
      if (userId.isPresent()) return userId;
    }
    if (isInternalKey(req.getHeader("X-Internal-Key"))) {
      return Optional.of(INTERNAL_READER);
    }
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth instanceof UserPrincipal principal) {
      return Optional.ofNullable(principal.getUserId());
    }
    return Optional.empty();
  }

  private boolean isInternalKey(String given) {
    if (internalKey == null || internalKey.isBlank() || given == null || given.isBlank()) {
      return false;
    }
    return MessageDigest.isEqual(
        internalKey.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
  }
}
