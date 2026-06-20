package com.platform.chatservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtUtil {

  private final Key signingKey;

  public JwtUtil(@Value("${app.jwt.secret}") String secret) {
    this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  public String extractUserId(String token) {
    return parseClaims(token).getSubject();
  }

  /** Role name claim (e.g. "Owner"), or null for legacy tokens. */
  public String extractRole(String token) {
    return parseClaims(token).get("role", String.class);
  }

  /** Enabled capability keys, empty for legacy tokens without the claim. */
  public List<String> extractPerms(String token) {
    return stringList(parseClaims(token).get("perms"));
  }

  /** Department ids the member belongs to, empty when absent. */
  public List<String> extractDepts(String token) {
    return stringList(parseClaims(token).get("depts"));
  }

  @SuppressWarnings("unchecked")
  private List<String> stringList(Object claim) {
    if (claim instanceof List<?> list) {
      return list.stream().map(String::valueOf).toList();
    }
    return List.of();
  }

  public boolean isValid(String token) {
    try {
      parseClaims(token);
      return true;
    } catch (JwtException | IllegalArgumentException e) {
      return false;
    }
  }

  private Claims parseClaims(String token) {
    return Jwts.parserBuilder().setSigningKey(signingKey).build().parseClaimsJws(token).getBody();
  }
}
