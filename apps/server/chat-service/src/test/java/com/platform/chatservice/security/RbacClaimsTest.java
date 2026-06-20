package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** P6 Part 1 — chat-service reads enterprise RBAC claims and exposes them. */
class RbacClaimsTest {

  private static final String SECRET = "test-secret-that-is-at-least-32-bytes-long!!";
  private final Key key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
  private final JwtUtil jwtUtil = new JwtUtil(SECRET);

  private String token(Map<String, Object> claims) {
    return Jwts.builder().setSubject("u1").addClaims(claims).signWith(key).compact();
  }

  @Test
  void extractsRolePermsAndDepts() {
    String jwt =
        token(
            Map.of(
                "role", "Owner",
                "perms", List.of("MANAGE_MEMBERS", "USE_GROUP_BOT"),
                "depts", List.of("d1", "d2")));

    assertThat(jwtUtil.extractRole(jwt)).isEqualTo("Owner");
    assertThat(jwtUtil.extractPerms(jwt)).containsExactly("MANAGE_MEMBERS", "USE_GROUP_BOT");
    assertThat(jwtUtil.extractDepts(jwt)).containsExactly("d1", "d2");
  }

  @Test
  void toleratesLegacyTokensWithoutClaims() {
    String jwt = token(Map.of());
    assertThat(jwtUtil.extractRole(jwt)).isNull();
    assertThat(jwtUtil.extractPerms(jwt)).isEmpty();
    assertThat(jwtUtil.extractDepts(jwt)).isEmpty();
  }

  @Test
  void principalMapsPermsToAuthoritiesAndHelpers() {
    UserPrincipal p = new UserPrincipal("u1", "Manager", List.of("USE_GROUP_BOT"), List.of("d1"));

    assertThat(p.hasPermission("USE_GROUP_BOT")).isTrue();
    assertThat(p.hasPermission("MANAGE_WORKSPACE")).isFalse();
    assertThat(p.inDepartment("d1")).isTrue();
    assertThat(p.inDepartment("d9")).isFalse();
    assertThat(p.getAuthorities()).extracting("authority").containsExactly("PERM_USE_GROUP_BOT");
  }

  @Test
  void legacyPrincipalConstructorHasNoClaims() {
    UserPrincipal p = new UserPrincipal("u1");
    assertThat(p.getRole()).isNull();
    assertThat(p.getPerms()).isEmpty();
    assertThat(p.getDepts()).isEmpty();
    assertThat(p.getAuthorities()).isEmpty();
  }
}
