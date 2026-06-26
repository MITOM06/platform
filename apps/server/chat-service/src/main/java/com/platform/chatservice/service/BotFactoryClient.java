package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.BotFactoryProperties;
import com.platform.chatservice.dto.BotFactoryBotRequest;
import com.platform.chatservice.dto.BotFactoryBotResponse;
import com.platform.chatservice.dto.BotFactoryMcpRequest;
import com.platform.chatservice.dto.BotFactoryProviderResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Calls an external Bot Factory bot's generic chat endpoint ({@code POST
 * {baseUrl}/api/bots/{factoryBotId}/chat}) the same way the Bot Factory Telegram worker does: a
 * {@code message} + {@code conversationKey} body, authenticated with the {@code x-worker-token}
 * header. Dependency-free (JDK HttpClient). The {@code chat} call degrades to {@code null} on any
 * failure so the caller can simply skip posting a reply.
 *
 * <p>The admin methods ({@code createBot}, {@code updateBot}, {@code deleteBot}, MCP injection,
 * {@code listProviders}) back the self-service "BotFather Zone" provisioning flow. Unlike {@code
 * chat} they throw {@link IllegalStateException} on failure so the orchestrator can surface the
 * error rather than silently swallowing it.
 */
@Service
@RequiredArgsConstructor
public class BotFactoryClient {

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

  /**
   * Name PON uses for the MCP server it injects into each member's bot. Must satisfy Bot Factory's
   * {@code ^[a-zA-Z0-9_]+$} validation — no hyphens.
   */
  public static final String PON_MCP_NAME = "pon_connector";

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

  // ---------------------------------------------------------------------------
  // Admin API (BotFather Zone provisioning) — throws on failure.
  // ---------------------------------------------------------------------------

  /** Create a new bot in Bot Factory. Returns the new bot id. */
  public String createBot(String name, String systemPrompt) {
    BotFactoryBotResponse bot =
        sendJson(
            "POST",
            "/api/bots",
            new BotFactoryBotRequest(name, null, systemPrompt, null),
            BotFactoryBotResponse.class);
    if (bot == null || bot.id() == null || bot.id().isBlank()) {
      throw new IllegalStateException("Bot Factory createBot returned no id");
    }
    return bot.id();
  }

  /** Update a bot's persona (name + system prompt) and default AI provider. */
  public void updateBot(String botId, String name, String systemPrompt, String defaultProviderId) {
    sendJson(
        "PATCH",
        "/api/bots/" + botId,
        new BotFactoryBotRequest(name, null, systemPrompt, defaultProviderId),
        BotFactoryBotResponse.class);
  }

  /** Delete a bot from Bot Factory. Cascades its MCP servers. */
  public void deleteBot(String botId) {
    sendJson("DELETE", "/api/bots/" + botId, null, null);
  }

  /** Inject an HTTP MCP server (Bearer auth) into a bot. */
  public void addMcpServer(String botId, String mcpName, String mcpUrl, String bearerToken) {
    String headers;
    try {
      headers = objectMapper.writeValueAsString(Map.of("Authorization", "Bearer " + bearerToken));
    } catch (IOException e) {
      throw new IllegalStateException("Failed to encode MCP headers", e);
    }
    sendJson(
        "POST",
        "/api/bots/" + botId + "/mcp",
        new BotFactoryMcpRequest(mcpName, "http", mcpUrl, headers, "apikey"),
        Void.class);
  }

  /**
   * Remove PON's injected MCP server from a bot. Bot Factory identifies MCP servers by id, so we
   * list the bot's servers, find the one named {@link #PON_MCP_NAME}, then delete it by id. No-op
   * when the bot has no such server.
   */
  public void removePonMcpServer(String botId) {
    requireConfigured();
    try {
      HttpResponse<String> res =
          httpClient.send(
              baseRequest("GET", "/api/bots/" + botId + "/mcp", null).build(),
              HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "Bot Factory list MCP failed: " + res.statusCode() + " " + res.body());
      }
      JsonNode servers = objectMapper.readTree(res.body());
      String serverId = null;
      if (servers.isArray()) {
        for (JsonNode s : servers) {
          if (PON_MCP_NAME.equals(s.path("name").asText())) {
            serverId = s.path("id").asText(null);
            break;
          }
        }
      }
      if (serverId != null && !serverId.isBlank()) {
        sendJson("DELETE", "/api/bots/" + botId + "/mcp/" + serverId, null, null);
      }
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("Bot Factory removePonMcpServer failed", e);
    }
  }

  /** List the AI providers configured in Bot Factory (for the model picker). */
  public List<BotFactoryProviderResponse> listProviders() {
    requireConfigured();
    try {
      HttpResponse<String> res =
          httpClient.send(
              baseRequest("GET", "/api/providers", null).build(),
              HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "Bot Factory listProviders failed: " + res.statusCode() + " " + res.body());
      }
      return objectMapper.readValue(
          res.body(), new TypeReference<List<BotFactoryProviderResponse>>() {});
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("Bot Factory listProviders failed", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private void requireConfigured() {
    if (props.getBaseUrl() == null || props.getBaseUrl().isBlank()) {
      throw new IllegalStateException("Bot Factory base URL is not configured");
    }
  }

  private HttpRequest.Builder baseRequest(String method, String path, String jsonBody) {
    HttpRequest.BodyPublisher publisher =
        jsonBody == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(jsonBody);
    return HttpRequest.newBuilder(URI.create(props.getBaseUrl() + path))
        .timeout(REQUEST_TIMEOUT)
        .header("Content-Type", "application/json")
        .header("x-worker-token", props.getWorkerToken() == null ? "" : props.getWorkerToken())
        .method(method, publisher);
  }

  /** Send a JSON request, throwing {@link IllegalStateException} on non-2xx. */
  private <T> T sendJson(String method, String path, Object body, Class<T> responseType) {
    requireConfigured();
    try {
      String json = body == null ? null : objectMapper.writeValueAsString(body);
      HttpResponse<String> res =
          httpClient.send(
              baseRequest(method, path, json).build(), HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        throw new IllegalStateException(
            "Bot Factory "
                + method
                + " "
                + path
                + " failed: "
                + res.statusCode()
                + " "
                + res.body());
      }
      if (responseType == null || responseType == Void.class) {
        return null;
      }
      return objectMapper.readValue(res.body(), responseType);
    } catch (IOException | InterruptedException e) {
      if (e instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new IllegalStateException("Bot Factory " + method + " " + path + " failed", e);
    }
  }
}
