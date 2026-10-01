package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthenticationFilterTest {

  private JwtUtil jwtUtil;
  private SessionValidator sessionValidator;
  private JwtAuthenticationFilter filter;
  private FilterChain chain;
  private MockHttpServletRequest request;
  private MockHttpServletResponse response;

  @BeforeEach
  void setUp() {
    jwtUtil = mock(JwtUtil.class);
    sessionValidator = mock(SessionValidator.class);
    filter = new JwtAuthenticationFilter(jwtUtil, sessionValidator);
    chain = mock(FilterChain.class);
    request = new MockHttpServletRequest("GET", "/api/conversations");
    response = new MockHttpServletResponse();
  }

  @AfterEach
  void clear() {
    SecurityContextHolder.clearContext();
  }

  private void token(String sid) {
    request.addHeader("Authorization", "Bearer tok");
    when(jwtUtil.isValid("tok")).thenReturn(true);
    when(jwtUtil.extractUserId("tok")).thenReturn("u1");
    when(jwtUtil.extractSid("tok")).thenReturn(sid);
    when(jwtUtil.extractPerms("tok")).thenReturn(List.of());
    when(jwtUtil.extractDepts("tok")).thenReturn(List.of());
  }

  @Test
  void validSessionAuthenticatesAndContinues() throws Exception {
    token("s1");
    when(sessionValidator.validate("s1", "u1")).thenReturn(SessionStatus.VALID);

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(request, response);
    assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("u1");
  }

  @Test
  void revokedSessionReturns401WithCodeAndStopsChain() throws Exception {
    token("s1");
    when(sessionValidator.validate("s1", "u1")).thenReturn(SessionStatus.SESSION_REVOKED);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentType()).startsWith("application/json");
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"SESSION_REVOKED\"}");
    verifyNoInteractions(chain);
    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
  }

  @Test
  void missingSessionReturns401SessionNotFound() throws Exception {
    token("s1");
    when(sessionValidator.validate("s1", "u1")).thenReturn(SessionStatus.SESSION_NOT_FOUND);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"SESSION_NOT_FOUND\"}");
  }

  @Test
  void tokenWithoutSidReturns401TokenInvalid() throws Exception {
    token(null);
    when(sessionValidator.validate(null, "u1")).thenReturn(SessionStatus.TOKEN_INVALID);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"TOKEN_INVALID\"}");
  }

  @Test
  void sessionStoreDownReturns503NotA401() throws Exception {
    token("s1");
    when(sessionValidator.validate("s1", "u1")).thenReturn(SessionStatus.UNAVAILABLE);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(503);
    assertThat(response.getContentAsString()).isEqualTo("{\"code\":\"SESSION_CHECK_UNAVAILABLE\"}");
    verifyNoInteractions(chain);
  }

  @Test
  void noTokenContinuesUnauthenticatedWithoutSessionLookup() throws Exception {
    filter.doFilter(request, response, chain);

    verify(chain).doFilter(request, response);
    verifyNoInteractions(sessionValidator);
    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
  }

  @Test
  void badSignatureContinuesUnauthenticatedWithoutSessionLookup() throws Exception {
    request.addHeader("Authorization", "Bearer forged");
    when(jwtUtil.isValid("forged")).thenReturn(false);

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(request, response);
    verifyNoInteractions(sessionValidator);
  }
}
