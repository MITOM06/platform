package com.platform.chatservice.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
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

  private final InternalKeyGuard internalKeyGuard;

  /** userId, {@link #INTERNAL_READER}, or empty when the request carries no valid credential. */
  public Optional<String> resolve(HttpServletRequest req) {
    String t = req.getParameter("t");
    if (t != null && !t.isEmpty()) {
      Optional<String> userId = mediaTokenService.verify(t);
      if (userId.isPresent()) return userId;
    }
    if (internalKeyGuard.check(req)) {
      return Optional.of(INTERNAL_READER);
    }
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth instanceof UserPrincipal principal) {
      return Optional.ofNullable(principal.getUserId());
    }
    return Optional.empty();
  }
}
