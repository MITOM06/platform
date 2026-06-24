package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.BotFactoryProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Calls an external Bot Factory bot's generic chat endpoint ({@code POST
 * {baseUrl}/api/bots/{factoryBotId}/chat}) the same way the Bot Factory Telegram worker does: a
 * {@code message} + {@code conversationKey} body, authenticated with the {@code x-worker-token}
 * header. Dependency-free (JDK HttpClient). Degrades to {@code null} on any failure so the caller
 * can simply skip posting a reply.
 */
@Service
@RequiredArgsConstructor
public class BotFactoryClient {

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

  private final BotFactoryProperties props;
  private final ObjectMapper objectMapper;

  private final HttpClient httpClient =
      HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();

  /** Returns the bot's reply text, or null when the bridge is unconfigured or the call fails. */
  public String chat(String factoryBotId, String message, String conversationKey) {
    if (props.getBaseUrl() == null || props.getBaseUrl().isBlank()) {
      return null;
    }
    try {
      String body =
          objectMapper.writeValueAsString(
              Map.of("message", message, "conversationKey", conversationKey));
      HttpRequest request =
          HttpRequest.newBuilder(
                  URI.create(props.getBaseUrl() + "/api/bots/" + factoryBotId + "/chat"))
              .timeout(REQUEST_TIMEOUT)
              .header("Content-Type", "application/json")
              .header(
                  "x-worker-token", props.getWorkerToken() == null ? "" : props.getWorkerToken())
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        return null;
      }
      JsonNode node = objectMapper.readTree(response.body());
      String reply = node.path("reply").asText(null);
      return (reply == null || reply.isBlank()) ? null : reply;
    } catch (Exception e) {
      // Network error / timeout / bad JSON — degrade gracefully.
      return null;
    }
  }
}
