package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.config.SecurityConfig;
import com.platform.chatservice.security.JwtAuthenticationFilter;
import com.platform.chatservice.security.JwtUtil;
import com.platform.chatservice.security.MediaTokenService;
import com.platform.chatservice.security.SessionStatus;
import com.platform.chatservice.security.SessionValidator;
import com.platform.chatservice.security.UploadReaderResolver;
import com.platform.chatservice.service.FileValidationService;
import com.platform.chatservice.service.RateLimiterService;
import com.platform.chatservice.service.VirusScanService;
import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = UploadController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  MediaTokenService.class,
  UploadReaderResolver.class,
  UploadControllerAuthTest.ClockConfig.class
})
@TestPropertySource(
    properties = {
      "app.cors.allowed-origins=https://app.example.com",
      "app.jwt.secret=test-secret-test-secret-test-secret-0123456789"
    })
class UploadControllerAuthTest {

  private static final String FILE_ID = "123e4567-e89b-12d3-a456-426614174000";
  private static final String USER = "user-1";
  private static final String INTERNAL = "internal-key-123";

  /** Mutable clock so a test can issue a token and then let it expire. */
  static class MutableClock extends Clock {
    Instant now = Instant.parse("2026-11-05T10:00:00Z");

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  @TestConfiguration
  static class ClockConfig {
    @Bean
    MutableClock mutableClock() {
      return new MutableClock();
    }

    @Bean
    Clock clock(MutableClock c) {
      return c;
    }
  }

  @Autowired private MockMvc mvc;
  @Autowired private UploadController controller;
  @Autowired private UploadReaderResolver resolver;
  @Autowired private MediaTokenService tokens;
  @Autowired private MutableClock clock;

  @MockBean private JwtUtil jwtUtil;
  @MockBean private SessionValidator sessionValidator;
  @MockBean private GridFsTemplate gridFsTemplate;
  @MockBean private RateLimiterService rateLimiterService;
  @MockBean private FileValidationService fileValidationService;
  @MockBean private VirusScanService virusScanService;

  @BeforeEach
  void setUp() throws Exception {
    clock.now = Instant.parse("2026-11-05T10:00:00Z");
    ReflectionTestUtils.setField(controller, "requireAuth", true);
    ReflectionTestUtils.setField(resolver, "internalKey", INTERNAL);

    GridFSFile file = org.mockito.Mockito.mock(GridFSFile.class);
    when(file.getMetadata()).thenReturn(new Document("uploadedBy", USER));
    when(file.getLength()).thenReturn(3L);
    GridFsResource resource = org.mockito.Mockito.mock(GridFsResource.class);
    when(resource.getContentType()).thenReturn("image/png");
    when(resource.getFilename()).thenReturn("a.png");
    when(resource.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[] {1, 2, 3}));
    when(gridFsTemplate.findOne(any(Query.class))).thenReturn(file);
    when(gridFsTemplate.getResource(file)).thenReturn(resource);

    when(jwtUtil.isValid("good-jwt")).thenReturn(true);
    when(jwtUtil.extractUserId("good-jwt")).thenReturn(USER);
    when(jwtUtil.extractPerms("good-jwt")).thenReturn(List.of());
    when(jwtUtil.extractDepts("good-jwt")).thenReturn(List.of());
    when(sessionValidator.validateToken(any(), any(), any())).thenReturn(SessionStatus.VALID);
  }

  private String path() {
    return "/api/uploads/" + FILE_ID;
  }

  @Test
  void flag_off_serves_without_auth() throws Exception {
    ReflectionTestUtils.setField(controller, "requireAuth", false);
    mvc.perform(get(path())).andExpect(status().isOk());
  }

  @Test
  void flag_on_no_credentials_401() throws Exception {
    mvc.perform(get(path())).andExpect(status().isUnauthorized()).andExpect(content().string(""));
  }

  @Test
  void flag_on_valid_t_200() throws Exception {
    mvc.perform(get(path()).param("t", tokens.issue(USER).token())).andExpect(status().isOk());
  }

  @Test
  void flag_on_expired_t_401() throws Exception {
    var issued = tokens.issue(USER);
    clock.now = issued.expiresAt().plus(Duration.ofSeconds(1));
    mvc.perform(get(path()).param("t", issued.token())).andExpect(status().isUnauthorized());
  }

  @Test
  void flag_on_bearer_jwt_200() throws Exception {
    mvc.perform(get(path()).header("Authorization", "Bearer good-jwt")).andExpect(status().isOk());
  }

  @Test
  void flag_on_internal_key_200() throws Exception {
    mvc.perform(get(path()).header("X-Internal-Key", INTERNAL)).andExpect(status().isOk());
  }

  @Test
  void flag_on_wrong_internal_key_401() throws Exception {
    mvc.perform(get(path()).header("X-Internal-Key", "nope")).andExpect(status().isUnauthorized());
  }

  @Test
  void flag_on_blank_configured_key_never_matches_401() throws Exception {
    ReflectionTestUtils.setField(resolver, "internalKey", "");
    mvc.perform(get(path()).header("X-Internal-Key", "")).andExpect(status().isUnauthorized());
    mvc.perform(get(path()).header("X-Internal-Key", " ")).andExpect(status().isUnauthorized());
  }

  @Test
  void token_endpoint_requires_jwt_401() throws Exception {
    mvc.perform(get("/api/uploads/token")).andExpect(status().isUnauthorized());
  }

  @Test
  void token_endpoint_returns_token_and_expiresAt() throws Exception {
    mvc.perform(get("/api/uploads/token").header("Authorization", "Bearer good-jwt"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.expiresAt").value("2026-11-06T12:00:00Z"));
  }
}
