package com.platform.chatservice.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates REST calls from the {@code Authorization: Bearer} access token. After the signature
 * check the token's {@code sid} must still be a live auth-service session ({@link
 * SessionValidator}); otherwise the request is rejected right here with {@code 401 {"code":
 * "SESSION_REVOKED" | "SESSION_NOT_FOUND" | "TOKEN_SESSION_MISMATCH" | "TOKEN_INVALID"}} (or {@code
 * 503 {"code":"SESSION_CHECK_UNAVAILABLE"}} if the session store is down), so a blocked /
 * logged-out user is cut off immediately instead of at token expiry. Requests without a token, or
 * with a token whose signature fails, continue unauthenticated exactly as before (public routes
 * still work; protected ones get the entry-point 401).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private final JwtUtil jwtUtil;
  private final SessionValidator sessionValidator;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String token = extractToken(request);

    if (StringUtils.hasText(token) && jwtUtil.isValid(token)) {
      String userId = jwtUtil.extractUserId(token);
      SessionStatus status = sessionValidator.validate(jwtUtil.extractSid(token), userId);
      if (!status.isValid()) {
        reject(response, status);
        return;
      }
      UserPrincipal principal =
          new UserPrincipal(
              userId,
              jwtUtil.extractRole(token),
              jwtUtil.extractPerms(token),
              jwtUtil.extractDepts(token));
      SecurityContextHolder.getContext().setAuthentication(principal);
    }

    filterChain.doFilter(request, response);
  }

  private void reject(HttpServletResponse response, SessionStatus status) throws IOException {
    SecurityContextHolder.clearContext();
    response.setStatus(
        status == SessionStatus.UNAVAILABLE
            ? HttpServletResponse.SC_SERVICE_UNAVAILABLE
            : HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.getWriter().write("{\"code\":\"" + status.code() + "\"}");
  }

  private String extractToken(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
      return header.substring(7);
    }
    return null;
  }
}
