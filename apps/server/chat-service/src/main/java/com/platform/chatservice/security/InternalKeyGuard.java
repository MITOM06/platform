package com.platform.chatservice.security;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The service-to-service key ({@code X-Internal-Key} = {@code app.connector.internal-key}, the same
 * secret as ai-service's {@code INTERNAL_API_KEY}). A blank configured key rejects everything.
 */
@Component
public class InternalKeyGuard {

  public static final String HEADER = "X-Internal-Key";

  @Value("${app.connector.internal-key:}")
  private String internalKey;

  /** Whether the request carries the valid internal key (constant-time comparison). */
  public boolean check(HttpServletRequest req) {
    return matches(req.getHeader(HEADER));
  }

  public boolean matches(String given) {
    if (internalKey == null || internalKey.isBlank() || given == null || given.isBlank()) {
      return false;
    }
    return MessageDigest.isEqual(
        internalKey.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
  }
}
