package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

/** Exact return values of {@link UploadReaderResolver#resolve}. */
class UploadReaderResolverTest {

  private static final String KEY = "internal-key-123";

  private MediaTokenService tokens;
  private UploadReaderResolver resolver;
  private MockHttpServletRequest req;

  @BeforeEach
  void setUp() {
    tokens = mock(MediaTokenService.class);
    when(tokens.verify("good-t")).thenReturn(Optional.of("user-t"));
    when(tokens.verify("bad-t")).thenReturn(Optional.empty());
    resolver = new UploadReaderResolver(tokens);
    ReflectionTestUtils.setField(resolver, "internalKey", KEY);
    req = new MockHttpServletRequest("GET", "/api/uploads/x");
    SecurityContextHolder.clearContext();
  }

  @AfterEach
  void clear() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void correct_internal_key_is_internal_reader() {
    req.addHeader("X-Internal-Key", KEY);
    assertThat(resolver.resolve(req)).contains(UploadReaderResolver.INTERNAL_READER);
    assertThat(UploadReaderResolver.INTERNAL_READER).isEqualTo("__internal__");
  }

  @Test
  void valid_media_token_is_its_user() {
    req.setParameter("t", "good-t");
    assertThat(resolver.resolve(req)).contains("user-t");
  }

  @Test
  void authenticated_jwt_principal_is_its_user() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal("user-jwt"));
    assertThat(resolver.resolve(req)).contains("user-jwt");
  }

  @Test
  void invalid_token_falls_through_to_jwt_principal() {
    req.setParameter("t", "bad-t");
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal("user-jwt"));
    assertThat(resolver.resolve(req)).contains("user-jwt");
  }

  @Test
  void nothing_is_empty() {
    assertThat(resolver.resolve(req)).isEmpty();
  }

  @Test
  void wrong_key_is_empty() {
    req.addHeader("X-Internal-Key", "nope");
    assertThat(resolver.resolve(req)).isEmpty();
  }

  @Test
  void invalid_token_alone_is_empty() {
    req.setParameter("t", "bad-t");
    assertThat(resolver.resolve(req)).isEmpty();
  }

  @Test
  void blank_configured_key_never_matches() {
    ReflectionTestUtils.setField(resolver, "internalKey", "");
    req.addHeader("X-Internal-Key", "");
    assertThat(resolver.resolve(req)).isEmpty();

    MockHttpServletRequest spaces = new MockHttpServletRequest("GET", "/api/uploads/x");
    ReflectionTestUtils.setField(resolver, "internalKey", " ");
    spaces.addHeader("X-Internal-Key", " ");
    assertThat(resolver.resolve(spaces)).isEmpty();
  }
}
