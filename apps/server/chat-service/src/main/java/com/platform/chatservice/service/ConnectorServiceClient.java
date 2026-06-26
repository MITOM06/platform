package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.ConnectorProperties;
import com.platform.chatservice.dto.BotSessionRequest;
import com.platform.chatservice.dto.BotSessionResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Calls the internal connector-service bot-session API ({@code /internal/bot/sessions}) protected
 * by the {@code x-internal-key} header. Used by {@code AssistantProvisioningService} to mint the
 * MCP token a member's Bot Factory assistant authenticates with, and to revoke it on tear-down.
 * Dependency-free (JDK HttpClient); throws {@link IllegalStateException} on failure.
 */
@Service
@RequiredArgsConstructor
public class ConnectorServiceClient {

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

  private final ConnectorProperties props;
  private final ObjectMapper objectMapper;

  private final HttpClient httpClient =
      HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();

  /** Issue a fresh MCP session token for {@code (userId, botUserId)}. Returns token + mcpUrl. */
  public BotSessionResponse issueToken(String userId, String botUserId) {
    requireConfigured();
    try {
      String body = objectMapper.writeValueAsString(new BotSessionRequest(userId, botUserId));
      HttpResponse<String> res =
          httpClient.send(baseRequest("POST", body).build(), HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "connector-service issueToken failed: " + res.statusCode() + " " + res.body());
      }
      BotSessionResponse parsed = objectMapper.readValue(res.body(), BotSessionResponse.class);
      if (parsed.token() == null || parsed.token().isBlank()) {
        throw new IllegalStateException("connector-service issueToken returned no token");
      }
      return parsed;
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("connector-service issueToken failed", e);
    }
  }

  /** Revoke the MCP session token for {@code (userId, botUserId)}. */
  public void revokeToken(String userId, String botUserId) {
    requireConfigured();
    try {
      String body = objectMapper.writeValueAsString(new BotSessionRequest(userId, botUserId));
      HttpResponse<String> res =
          httpClient.send(
              baseRequest("DELETE", body).build(), HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "connector-service revokeToken failed: " + res.statusCode() + " " + res.body());
      }
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("connector-service revokeToken failed", e);
    }
  }

  private void requireConfigured() {
    if (props.getBaseUrl() == null || props.getBaseUrl().isBlank()) {
      throw new IllegalStateException("connector-service base URL is not configured");
    }
  }

  private HttpRequest.Builder baseRequest(String method, String jsonBody) {
    return HttpRequest.newBuilder(URI.create(props.getBaseUrl() + "/internal/bot/sessions"))
        .timeout(REQUEST_TIMEOUT)
        .header("Content-Type", "application/json")
        .header("x-internal-key", props.getInternalKey() == null ? "" : props.getInternalKey())
        .method(method, HttpRequest.BodyPublishers.ofString(jsonBody));
  }
}
