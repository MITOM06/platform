# Bot Factory Personal-Assistant Bridge — Implementation Plan (Phase 1: server-side)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Bot Factory bot act as a PON member's personal assistant inside a 1-1 chat conversation — the member's messages are answered by calling Bot Factory's existing `POST /api/bots/{factoryBotId}/chat` HTTP API, and the reply is persisted + broadcast like an AI message.

**Architecture:** All code lives in PON `chat-service` (Spring Boot). When a member sends a message in a 1-1 conversation whose other participant is a registered external (Bot Factory) bot they own, chat-service calls Bot Factory synchronously on a background thread (mirroring how the existing `@AI` mention path dispatches async), passing `conversationKey = "pon:<conversationId>"`, then persists the reply via a generalized `saveBotMessage` and broadcasts it to `/topic/conversation/{id}`. Bot Factory is **never modified** — it is an external service called over HTTP with its `x-worker-token`. The native `@AI` (RabbitMQ → ai-service) path is left untouched; the two coexist.

**Tech Stack:** Spring Boot 3, Spring Data MongoDB, Spring WebSocket/STOMP, JDK `HttpClient`, Jackson, Lombok, JUnit 5 + Mockito 5 + AssertJ (via `spring-boot-starter-test`), Maven.

## Global Constraints

- **Jakarta only:** use `jakarta.*` imports, never `javax.*`.
- **Injection:** constructor injection via Lombok `@RequiredArgsConstructor`; never `@Autowired` on fields.
- **Entities:** `@Document(collection="...")` + Lombok `@Data @Builder @NoArgsConstructor @AllArgsConstructor`; `@CreatedDate` for timestamps.
- **DTOs:** never expose `@Document` entities from controllers — use `record` Request/Response types.
- **Identity:** read the user id from `SecurityContextHolder` (`UserPrincipal.getUserId()`), never from request body params.
- **File size:** services/controllers ≤ 500 lines.
- **MongoDB:** database `platform`, port `27018` (non-standard).
- **Do NOT modify** `apps/server/auth-service/` or the Bot Factory repo.
- **Build/test:** run from `apps/server/chat-service/`; tests via `mvn -q -Dtest=<ClassName> test` (no `mvnw` wrapper — use system `mvn`).
- **Scope:** Phase 1 = server-side bridge for **1-1 conversations only**. Group `@mention` (Phase 2), web/Flutter UI (separate plan), and connector-service token-vault + auto-provisioning (Phase 4) are out of scope here.

All paths below are relative to `/Users/phong/projects/personal/platform/apps/server/chat-service/`. Package root: `src/main/java/com/platform/chatservice/`.

---

### Task 1: Generalize AI message persistence to `saveBotMessage`

Refactor `AiMessageService` so an arbitrary bot sender id can be persisted + broadcast, without changing existing `saveAiMessage` behavior.

**Files:**
- Modify: `src/main/java/com/platform/chatservice/service/AiMessageService.java`
- Test: `src/test/java/com/platform/chatservice/service/AiMessageServiceTest.java` (create)

**Interfaces:**
- Produces: `AiMessageService.saveBotMessage(String conversationId, String senderId, String content): MessageResponse` — persists a `type:"ai"` message with the given `senderId`, updates the conversation `lastMessage`, broadcasts to `/topic/conversation/{conversationId}`, returns the mapped `MessageResponse`.
- Unchanged: `saveAiMessage(String, String, AiTraceData)` keeps using `AiConstants.AI_BOT_USER_ID`.

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/platform/chatservice/service/AiMessageServiceTest.java`:

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiMessageServiceTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private MessageMapper messageMapper;

  @Test
  void saveBotMessage_persistsWithGivenSenderAndBroadcasts() {
    AiMessageService service =
        new AiMessageService(
            messageRepository, conversationRepository, messagingTemplate, messageMapper);
    when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));
    when(conversationRepository.findById(any())).thenReturn(Optional.empty());

    service.saveBotMessage("conv-1", "extbot:bf-1", "Hello from the assistant");

    ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
    verify(messageRepository).save(captor.capture());
    Message saved = captor.getValue();
    assertThat(saved.getConversationId()).isEqualTo("conv-1");
    assertThat(saved.getSenderId()).isEqualTo("extbot:bf-1");
    assertThat(saved.getType()).isEqualTo("ai");
    assertThat(saved.getContent()).isEqualTo("Hello from the assistant");
    verify(messagingTemplate).convertAndSend(eq("/topic/conversation/conv-1"), any(Object.class));
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=AiMessageServiceTest test`
Expected: COMPILE FAILURE — `saveBotMessage` does not exist.

- [ ] **Step 3: Refactor `AiMessageService` to add `saveBotMessage` and a shared private helper**

In `src/main/java/com/platform/chatservice/service/AiMessageService.java`, replace the body of `saveAiMessage` (lines 36–66) with a delegating call, and add the new method + helper. The final form of the two methods + helper:

```java
  /**
   * Save an AI-generated message (with optional trace) and broadcast it to the conversation topic.
   * Called by AiResponseListener when AI_STREAM_DONE is received from Redis.
   */
  public MessageResponse saveAiMessage(String conversationId, String content, AiTraceData trace) {
    return persistAndBroadcast(conversationId, AiConstants.AI_BOT_USER_ID, content, "ai", trace);
  }

  /**
   * Save a message authored by an external bot (Bot Factory personal assistant) under its own
   * sender id and broadcast it to the conversation topic. Same wire shape as an AI message
   * ({@code type:"ai"}) so the clients render it as an assistant bubble.
   */
  public MessageResponse saveBotMessage(String conversationId, String senderId, String content) {
    return persistAndBroadcast(conversationId, senderId, content, "ai", null);
  }

  private MessageResponse persistAndBroadcast(
      String conversationId, String senderId, String content, String type, AiTraceData trace) {
    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(conversationId)
                .senderId(senderId)
                .content(content)
                .type(type)
                .readBy(new ArrayList<>())
                .trace(trace)
                .build());

    Instant savedAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    conversationRepository
        .findById(conversationId)
        .ifPresent(
            conv -> {
              conv.setLastMessage(
                  Conversation.LastMessage.builder()
                      .content(content)
                      .senderId(senderId)
                      .createdAt(savedAt)
                      .build());
              conv.setLastMessageAt(savedAt);
              conversationRepository.save(conv);
            });

    MessageResponse response = messageMapper.toResponse(message);
    messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, response);
    return response;
  }
```

Leave `saveMeetingSummary` and `getMessageTrace` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=AiMessageServiceTest test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiMessageService.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/AiMessageServiceTest.java
git commit -m "refactor(chat): add saveBotMessage for external bot replies

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Bot Factory HTTP client + config properties

A dependency-free JDK `HttpClient` wrapper that calls Bot Factory's `/api/bots/{id}/chat` and returns the reply text (or `null` on any failure — graceful, mirroring `LinkPreviewService`).

**Files:**
- Create: `src/main/java/com/platform/chatservice/config/BotFactoryProperties.java`
- Create: `src/main/java/com/platform/chatservice/service/BotFactoryClient.java`
- Modify: `src/main/resources/application.yml`
- Modify: `.env.example` (repo root has its own; this is the service-local example if present — otherwise skip)
- Test: `src/test/java/com/platform/chatservice/service/BotFactoryClientTest.java` (create)

**Interfaces:**
- Produces: `BotFactoryProperties` (`getBaseUrl()`, `getWorkerToken()`), bean bound to prefix `app.botfactory`.
- Produces: `BotFactoryClient.chat(String factoryBotId, String message, String conversationKey): String` — returns the `reply` field of Bot Factory's JSON response, or `null` if base URL is unset / network error / non-2xx / blank reply.

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/platform/chatservice/service/BotFactoryClientTest.java`. Uses the JDK built-in `com.sun.net.httpserver.HttpServer` as a stub Bot Factory — no extra dependency:

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.BotFactoryProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BotFactoryClientTest {

  private HttpServer server;
  private int port;
  private final AtomicReference<String> lastBody = new AtomicReference<>();
  private final AtomicReference<String> lastToken = new AtomicReference<>();
  private final AtomicReference<String> lastPath = new AtomicReference<>();
  private volatile int statusToReturn = 200;
  private volatile String responseJson = "{\"reply\":\"hi there\"}";

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    port = server.getAddress().getPort();
    server.createContext(
        "/api/bots/",
        exchange -> {
          lastPath.set(exchange.getRequestURI().getPath());
          lastToken.set(exchange.getRequestHeaders().getFirst("x-worker-token"));
          lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
          byte[] out = responseJson.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(statusToReturn, out.length);
          exchange.getResponseBody().write(out);
          exchange.close();
        });
    server.start();
  }

  @AfterEach
  void tearDown() {
    server.stop(0);
  }

  private BotFactoryClient client() {
    BotFactoryProperties props = new BotFactoryProperties();
    props.setBaseUrl("http://localhost:" + port);
    props.setWorkerToken("secret-token");
    return new BotFactoryClient(props, new ObjectMapper());
  }

  @Test
  void chat_sendsTokenAndBody_andReturnsReply() {
    String reply = client().chat("bf-1", "hello", "pon:conv-1");

    assertThat(reply).isEqualTo("hi there");
    assertThat(lastPath.get()).isEqualTo("/api/bots/bf-1/chat");
    assertThat(lastToken.get()).isEqualTo("secret-token");
    assertThat(lastBody.get()).contains("\"message\":\"hello\"");
    assertThat(lastBody.get()).contains("\"conversationKey\":\"pon:conv-1\"");
  }

  @Test
  void chat_returnsNullOnNon2xx() {
    statusToReturn = 500;
    assertThat(client().chat("bf-1", "hello", "pon:conv-1")).isNull();
  }

  @Test
  void chat_returnsNullWhenBaseUrlUnset() {
    BotFactoryProperties props = new BotFactoryProperties();
    BotFactoryClient c = new BotFactoryClient(props, new ObjectMapper());
    assertThat(c.chat("bf-1", "hello", "pon:conv-1")).isNull();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=BotFactoryClientTest test`
Expected: COMPILE FAILURE — `BotFactoryProperties` / `BotFactoryClient` do not exist.

- [ ] **Step 3: Create `BotFactoryProperties`**

Create `src/main/java/com/platform/chatservice/config/BotFactoryProperties.java`:

```java
package com.platform.chatservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Connection settings for the external Bot Factory service that powers per-member personal
 * assistants. Bound from {@code app.botfactory.*}. When {@code baseUrl} is blank the bridge is
 * disabled (calls return null) so the service runs fine without Bot Factory configured.
 */
@Component
@ConfigurationProperties(prefix = "app.botfactory")
@Data
public class BotFactoryProperties {
  private String baseUrl;
  private String workerToken;
}
```

- [ ] **Step 4: Create `BotFactoryClient`**

Create `src/main/java/com/platform/chatservice/service/BotFactoryClient.java`:

```java
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
 * Calls an external Bot Factory bot's generic chat endpoint
 * ({@code POST {baseUrl}/api/bots/{factoryBotId}/chat}) the same way the Bot Factory Telegram
 * worker does: a {@code message} + {@code conversationKey} body, authenticated with the
 * {@code x-worker-token} header. Dependency-free (JDK HttpClient). Degrades to {@code null} on any
 * failure so the caller can simply skip posting a reply.
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
              .header("x-worker-token", props.getWorkerToken() == null ? "" : props.getWorkerToken())
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
```

- [ ] **Step 5: Add config keys**

In `src/main/resources/application.yml`, under the existing `app:` tree (next to `app.jwt.secret`), add:

```yaml
app:
  botfactory:
    base-url: ${BOTFACTORY_BASE_URL:}
    worker-token: ${BOTFACTORY_WORKER_TOKEN:}
```

(If `app:` already exists as a nested map, merge `botfactory:` under it rather than adding a second `app:` key.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=BotFactoryClientTest test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/config/BotFactoryProperties.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/service/BotFactoryClient.java \
        apps/server/chat-service/src/main/resources/application.yml \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/BotFactoryClientTest.java
git commit -m "feat(chat): add Bot Factory HTTP client + config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: External-bot registry model + `ExternalBotService`

The MongoDB registry mapping a PON member → their Bot Factory bot, plus the service that decides whether a 1-1 message should be answered by a bot and performs the call+persist.

**Files:**
- Create: `src/main/java/com/platform/chatservice/model/ExternalBot.java`
- Create: `src/main/java/com/platform/chatservice/repository/ExternalBotRepository.java`
- Create: `src/main/java/com/platform/chatservice/service/ExternalBotService.java`
- Test: `src/test/java/com/platform/chatservice/service/ExternalBotServiceTest.java` (create)

**Interfaces:**
- Consumes: `AiMessageService.saveBotMessage(...)` (Task 1); `BotFactoryClient.chat(...)` (Task 2); `ConversationService.getParticipants(String): List<String>` (existing).
- Produces:
  - `ExternalBot` entity with fields `id, botUserId, factoryBotId, ownerUserId, name, avatarUrl, enabled (boolean), createdAt`.
  - `ExternalBotRepository.findByBotUserId(String): Optional<ExternalBot>`, `findByOwnerUserIdAndEnabledTrue(String): Optional<ExternalBot>`, `existsByBotUserId(String): boolean`.
  - `ExternalBotService.resolveAssistant(String conversationId, String senderId): Optional<ExternalBot>` — the bot to answer, only for a 2-participant conversation where the other participant is an enabled bot owned by `senderId`.
  - `ExternalBotService.reply(ExternalBot bot, String conversationId, String content): void` — calls Bot Factory with `conversationKey="pon:"+conversationId` and persists the reply (no-op on null reply).

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/platform/chatservice/service/ExternalBotServiceTest.java`:

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExternalBotServiceTest {

  @Mock private ConversationService conversationService;
  @Mock private ExternalBotRepository externalBotRepository;
  @Mock private BotFactoryClient botFactoryClient;
  @Mock private AiMessageService aiMessageService;

  private ExternalBotService service() {
    return new ExternalBotService(
        conversationService, externalBotRepository, botFactoryClient, aiMessageService);
  }

  private ExternalBot bot() {
    return ExternalBot.builder()
        .id("eb-1")
        .botUserId("extbot:bf-1")
        .factoryBotId("bf-1")
        .ownerUserId("user-1")
        .name("My Assistant")
        .enabled(true)
        .build();
  }

  @Test
  void resolveAssistant_returnsBot_forOwned1on1() {
    when(conversationService.getParticipants("conv-1"))
        .thenReturn(List.of("user-1", "extbot:bf-1"));
    when(externalBotRepository.findByBotUserId("extbot:bf-1")).thenReturn(Optional.of(bot()));

    Optional<ExternalBot> result = service().resolveAssistant("conv-1", "user-1");

    assertThat(result).isPresent();
    assertThat(result.get().getFactoryBotId()).isEqualTo("bf-1");
  }

  @Test
  void resolveAssistant_empty_whenGroup() {
    when(conversationService.getParticipants("conv-1"))
        .thenReturn(List.of("user-1", "user-2", "extbot:bf-1"));
    assertThat(service().resolveAssistant("conv-1", "user-1")).isEmpty();
  }

  @Test
  void resolveAssistant_empty_whenSenderIsNotOwner() {
    when(conversationService.getParticipants("conv-1"))
        .thenReturn(List.of("user-2", "extbot:bf-1"));
    when(externalBotRepository.findByBotUserId("extbot:bf-1")).thenReturn(Optional.of(bot()));
    assertThat(service().resolveAssistant("conv-1", "user-2")).isEmpty();
  }

  @Test
  void reply_persistsReturnedText() {
    when(botFactoryClient.chat("bf-1", "hello", "pon:conv-1")).thenReturn("hi back");
    service().reply(bot(), "conv-1", "hello");
    verify(aiMessageService).saveBotMessage("conv-1", "extbot:bf-1", "hi back");
  }

  @Test
  void reply_noop_whenClientReturnsNull() {
    when(botFactoryClient.chat(any(), any(), any())).thenReturn(null);
    service().reply(bot(), "conv-1", "hello");
    verify(aiMessageService, never()).saveBotMessage(eq("conv-1"), any(), any());
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ExternalBotServiceTest test`
Expected: COMPILE FAILURE — `ExternalBot` / `ExternalBotRepository` / `ExternalBotService` do not exist.

- [ ] **Step 3: Create the `ExternalBot` entity**

Create `src/main/java/com/platform/chatservice/model/ExternalBot.java`:

```java
package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Registry entry mapping a PON member ({@code ownerUserId}) to their personal Bot Factory bot
 * ({@code factoryBotId}). {@code botUserId} is the synthetic participant/sender id used inside chat
 * (e.g. {@code "extbot:<factoryBotId>"}) — it sits in {@code Conversation.participants} and is the
 * {@code senderId} on the bot's messages, exactly like the built-in AI bot id.
 */
@Document(collection = "external_bots")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalBot {

  @Id private String id;

  @Indexed(unique = true)
  private String botUserId;

  private String factoryBotId;

  @Indexed private String ownerUserId;

  private String name;

  private String avatarUrl;

  @Builder.Default private boolean enabled = true;

  @CreatedDate private Instant createdAt;
}
```

- [ ] **Step 4: Create the repository**

Create `src/main/java/com/platform/chatservice/repository/ExternalBotRepository.java`:

```java
package com.platform.chatservice.repository;

import com.platform.chatservice.model.ExternalBot;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ExternalBotRepository extends MongoRepository<ExternalBot, String> {

  Optional<ExternalBot> findByBotUserId(String botUserId);

  Optional<ExternalBot> findByOwnerUserIdAndEnabledTrue(String ownerUserId);
}
```

- [ ] **Step 5: Create `ExternalBotService`**

Create `src/main/java/com/platform/chatservice/service/ExternalBotService.java`:

```java
package com.platform.chatservice.service;

import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Bridges PON chat to a member's external Bot Factory personal assistant. Phase 1 handles 1-1
 * conversations only: a 2-participant conversation whose other member is an enabled bot owned by
 * the sender. Group {@code @mention} routing is a later phase.
 */
@Service
@RequiredArgsConstructor
public class ExternalBotService {

  private final ConversationService conversationService;
  private final ExternalBotRepository externalBotRepository;
  private final BotFactoryClient botFactoryClient;
  private final AiMessageService aiMessageService;

  /**
   * The personal-assistant bot that should answer this message, or empty when the conversation is
   * not a 1-1 between {@code senderId} and an enabled bot they own.
   */
  public Optional<ExternalBot> resolveAssistant(String conversationId, String senderId) {
    List<String> participants = conversationService.getParticipants(conversationId);
    if (participants == null || participants.size() != 2 || !participants.contains(senderId)) {
      return Optional.empty();
    }
    String other =
        participants.get(0).equals(senderId) ? participants.get(1) : participants.get(0);
    if (other.equals(senderId)) {
      return Optional.empty();
    }
    return externalBotRepository
        .findByBotUserId(other)
        .filter(ExternalBot::isEnabled)
        .filter(bot -> senderId.equals(bot.getOwnerUserId()));
  }

  /**
   * Ask Bot Factory for a reply (memory keyed per PON conversation) and persist+broadcast it as the
   * bot. No-op when Bot Factory is unconfigured or returns nothing.
   */
  public void reply(ExternalBot bot, String conversationId, String content) {
    String replyText =
        botFactoryClient.chat(bot.getFactoryBotId(), content, "pon:" + conversationId);
    if (replyText != null && !replyText.isBlank()) {
      aiMessageService.saveBotMessage(conversationId, bot.getBotUserId(), replyText);
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ExternalBotServiceTest test`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/model/ExternalBot.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/repository/ExternalBotRepository.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/service/ExternalBotService.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/ExternalBotServiceTest.java
git commit -m "feat(chat): add external-bot registry + bridge service

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Trigger the bridge from the message paths

Wire `ExternalBotService` into both message entry points (STOMP `ChatController.send` and REST `MessageController.sendMessage`) so a 1-1 message to a personal-assistant bot is answered on a background thread — mirroring the existing async `@AI` dispatch.

**Files:**
- Modify: `src/main/java/com/platform/chatservice/controller/ChatController.java`
- Modify: `src/main/java/com/platform/chatservice/controller/MessageController.java`
- Test: `src/test/java/com/platform/chatservice/controller/ChatControllerExternalBotTest.java` (create)

**Interfaces:**
- Consumes: `ExternalBotService.resolveAssistant(...)` + `reply(...)` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/platform/chatservice/controller/ChatControllerExternalBotTest.java`:

```java
package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.CallService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.FcmService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.security.Principal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatControllerExternalBotTest {

  @Mock private MessageService messageService;
  @Mock private ConversationService conversationService;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private FcmService fcmService;
  @Mock private RateLimiterService rateLimiterService;
  @Mock private AiRedisPublisher aiRedisPublisher;
  @Mock private CallService callService;
  @Mock private ExternalBotService externalBotService;
  @Mock private MessageResponse messageResponse;

  @Test
  void send_triggersAssistantReply_forResolvedBot() {
    ChatController controller =
        new ChatController(
            messageService,
            conversationService,
            messagingTemplate,
            fcmService,
            rateLimiterService,
            aiRedisPublisher,
            callService,
            externalBotService);

    when(messageService.sendMessage(any(), any())).thenReturn(messageResponse);
    when(messageResponse.mentions()).thenReturn(null);
    when(conversationService.getParticipants("conv-1")).thenReturn(List.of("user-1"));
    ExternalBot bot =
        ExternalBot.builder().botUserId("extbot:bf-1").factoryBotId("bf-1").ownerUserId("user-1").build();
    when(externalBotService.resolveAssistant("conv-1", "user-1")).thenReturn(Optional.of(bot));

    ChatMessageDto dto = new ChatMessageDto();
    dto.setConversationId("conv-1");
    dto.setContent("what's on my calendar?");
    dto.setType("text");
    Principal principal = () -> "user-1";

    controller.send(dto, principal);

    verify(externalBotService, timeout(1000)).reply(bot, "conv-1", "what's on my calendar?");
  }

  @Test
  void send_noAssistant_doesNotReply() {
    ChatController controller =
        new ChatController(
            messageService,
            conversationService,
            messagingTemplate,
            fcmService,
            rateLimiterService,
            aiRedisPublisher,
            callService,
            externalBotService);

    when(messageService.sendMessage(any(), any())).thenReturn(messageResponse);
    when(messageResponse.mentions()).thenReturn(null);
    when(conversationService.getParticipants("conv-1")).thenReturn(List.of("user-1"));
    when(externalBotService.resolveAssistant("conv-1", "user-1")).thenReturn(Optional.empty());

    ChatMessageDto dto = new ChatMessageDto();
    dto.setConversationId("conv-1");
    dto.setContent("hello");
    dto.setType("text");
    Principal principal = () -> "user-1";

    controller.send(dto, principal);

    verify(externalBotService, after(300).never()).reply(any(), any(), any());
  }
}
```

> Note: this test constructs `ChatController` with the constructor arg order produced by Lombok `@RequiredArgsConstructor` — field declaration order. Step 3 adds `externalBotService` as the **last** field, so it is the last constructor argument.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ChatControllerExternalBotTest test`
Expected: COMPILE FAILURE — `ChatController` has no constructor taking `ExternalBotService`.

- [ ] **Step 3: Wire `ChatController`**

In `src/main/java/com/platform/chatservice/controller/ChatController.java`:

(a) Add the import near the other service imports (after line 11):

```java
import com.platform.chatservice.service.ExternalBotService;
```

(b) Add the field as the **last** injected field (immediately after `private final CallService callService;`, line 37):

```java
  private final ExternalBotService externalBotService;
```

(c) In `send(...)`, immediately after the existing async `@AI` block (after line 73, before the `List<String> mentions = ...` line), insert:

```java
    // Async personal-assistant (Bot Factory) trigger — 1-1 conversation with the member's bot.
    if (dto.getContent() != null) {
      final String botUid = principal.getName();
      final String botConvId = dto.getConversationId();
      final String botRaw = dto.getContent();
      externalBotService
          .resolveAssistant(botConvId, botUid)
          .ifPresent(
              bot ->
                  CompletableFuture.runAsync(
                      () -> {
                        try {
                          externalBotService.reply(bot, botConvId, botRaw);
                        } catch (Exception ignored) {
                        }
                      }));
    }
```

- [ ] **Step 4: Wire `MessageController` (REST fallback)**

In `src/main/java/com/platform/chatservice/controller/MessageController.java`:

(a) Add the import (after line 17):

```java
import com.platform.chatservice.service.ExternalBotService;
```

(b) Add the field as the **last** injected field (after `private final AiFeedbackService aiFeedbackService;`, line 40):

```java
  private final ExternalBotService externalBotService;
```

(c) In `sendMessage(...)`, immediately after the existing async `@AI` block (after line 63, before `return response;`), insert:

```java
    if (request.content() != null) {
      final String botConvId = request.conversationId();
      final String botRaw = request.content();
      externalBotService
          .resolveAssistant(botConvId, uid)
          .ifPresent(
              bot ->
                  CompletableFuture.runAsync(
                      () -> {
                        try {
                          externalBotService.reply(bot, botConvId, botRaw);
                        } catch (Exception ignored) {
                        }
                      }));
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ChatControllerExternalBotTest test`
Expected: PASS (2 tests).

Then run the existing controller test to confirm no regression:
Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ChatControllerTest test`
Expected: PASS (existing tests still green). If `ChatControllerTest` constructs `ChatController` directly, add a mocked `ExternalBotService` as the last constructor argument there too.

- [ ] **Step 6: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ChatController.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/controller/ChatControllerExternalBotTest.java
git commit -m "feat(chat): trigger Bot Factory assistant on 1-1 messages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Auto-accept conversations opened with a bot

Generalize the AI-bot special-case in `ConversationService.createConversation` so opening a 1-1 with a registered external bot is auto-`ACCEPTED` (never stuck behind a stranger-request banner), exactly like the built-in AI bot.

**Files:**
- Modify: `src/main/java/com/platform/chatservice/service/ConversationService.java`
- Test: `src/test/java/com/platform/chatservice/service/ConversationServiceTest.java` (add a test + a mock field)

**Interfaces:**
- Consumes: `ExternalBotRepository.findByBotUserId(...)` (Task 3).

- [ ] **Step 1: Write the failing test**

In `src/test/java/com/platform/chatservice/service/ConversationServiceTest.java`:

(a) Add a mock field after the existing mocks (after line 38):

```java
  @Mock private com.platform.chatservice.repository.ExternalBotRepository externalBotRepository;
```

(b) Add this test method (after `createConversation_ShouldSaveAndReturnResponse`, around line 69):

```java
  @Test
  void createConversation_withExternalBot_isAutoAccepted() {
    when(conversationRepository.findOneOnOneConversation(any())).thenReturn(Optional.empty());
    when(externalBotRepository.findByBotUserId("extbot:bf-1"))
        .thenReturn(
            Optional.of(
                com.platform.chatservice.model.ExternalBot.builder()
                    .botUserId("extbot:bf-1")
                    .enabled(true)
                    .build()));
    org.mockito.ArgumentCaptor<Conversation> captor =
        org.mockito.ArgumentCaptor.forClass(Conversation.class);
    when(conversationCacheService.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

    conversationService.createConversation(USER_ID, "extbot:bf-1");

    assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_ACCEPTED);
    verifyNoInteractions(friendshipRepository);
  }
```

(c) Add the static import if not already present at the top:

```java
import static org.mockito.Mockito.verifyNoInteractions;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ConversationServiceTest test`
Expected: COMPILE FAILURE — `ConversationService` has no `ExternalBotRepository` dependency (the `@InjectMocks` mock is unused / constructor mismatch) and/or the new behavior is absent.

- [ ] **Step 3: Add the dependency + generalize the bot check**

In `src/main/java/com/platform/chatservice/service/ConversationService.java`:

(a) Add the import (after line 13):

```java
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
```

(b) Add the field after `private final MongoTemplate mongoTemplate;` (line 41):

```java
  private final ExternalBotRepository externalBotRepository;
```

(c) Replace the `boolean friends = ...` expression (lines 90–92) with:

```java
    boolean friends =
        isBotParticipant(participantId)
            || friendshipRepository.findAcceptedBetween(currentUserId, participantId).isPresent();
```

(d) Add this private helper near the other private helpers (e.g. after `isAdmin`, around line 426):

```java
  /** A bot participant (built-in AI or a registered, enabled external bot) is always accepted. */
  private boolean isBotParticipant(String participantId) {
    if (AiConstants.AI_BOT_USER_ID.equals(participantId)) {
      return true;
    }
    return externalBotRepository.findByBotUserId(participantId).map(ExternalBot::isEnabled).orElse(false);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ConversationServiceTest test`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/ConversationServiceTest.java
git commit -m "feat(chat): auto-accept 1-1 conversations with external bots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Register a bot + resolve a member's assistant (REST)

An admin endpoint to register/update a member→bot mapping (RBAC-gated), and a member endpoint returning their assistant's identity so a client can open the 1-1 conversation.

**Files:**
- Create: `src/main/java/com/platform/chatservice/dto/CreateExternalBotRequest.java`
- Create: `src/main/java/com/platform/chatservice/dto/ExternalBotResponse.java`
- Create: `src/main/java/com/platform/chatservice/dto/AssistantResponse.java`
- Create: `src/main/java/com/platform/chatservice/service/ExternalBotAdminService.java`
- Create: `src/main/java/com/platform/chatservice/controller/ExternalBotController.java`
- Test: `src/test/java/com/platform/chatservice/service/ExternalBotAdminServiceTest.java` (create)

**Interfaces:**
- Consumes: `ExternalBotRepository` (Task 3).
- Produces:
  - `POST /api/admin/external-bots` (perm `MANAGE_WORKSPACE`) → `ExternalBotResponse`.
  - `GET /api/assistant/me` → `200 AssistantResponse` or `404`.
  - `ExternalBotAdminService.register(ownerUserId, factoryBotId, name, avatarUrl): ExternalBotResponse`.
  - `ExternalBotAdminService.findAssistantFor(ownerUserId): Optional<ExternalBotResponse>`.

> **Prereq:** `@PreAuthorize` only enforces if method security is enabled. `UserPrincipal`'s javadoc states controllers gate with `@PreAuthorize("hasAuthority('PERM_...')")`, so it should already be on — confirm a `@EnableMethodSecurity` config exists (grep `EnableMethodSecurity` under `src/main/java`). If absent, add `@EnableMethodSecurity` to the security config class; without it the admin endpoint would be unguarded.

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/platform/chatservice/service/ExternalBotAdminServiceTest.java`:

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExternalBotAdminServiceTest {

  @Mock private ExternalBotRepository repo;

  @Test
  void register_createsMappingWithDerivedBotUserId() {
    when(repo.findByBotUserId("extbot:bf-1")).thenReturn(Optional.empty());
    when(repo.save(any(ExternalBot.class))).thenAnswer(inv -> inv.getArgument(0));

    ExternalBotAdminService service = new ExternalBotAdminService(repo);
    ExternalBotResponse res = service.register("user-1", "bf-1", "My Assistant", null);

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    assertThat(res.ownerUserId()).isEqualTo("user-1");
    assertThat(res.factoryBotId()).isEqualTo("bf-1");
    assertThat(res.enabled()).isTrue();
  }

  @Test
  void findAssistantFor_returnsMapped() {
    when(repo.findByOwnerUserIdAndEnabledTrue("user-1"))
        .thenReturn(
            Optional.of(
                ExternalBot.builder()
                    .id("eb-1")
                    .botUserId("extbot:bf-1")
                    .factoryBotId("bf-1")
                    .ownerUserId("user-1")
                    .name("My Assistant")
                    .enabled(true)
                    .build()));

    ExternalBotAdminService service = new ExternalBotAdminService(repo);
    Optional<ExternalBotResponse> res = service.findAssistantFor("user-1");

    assertThat(res).isPresent();
    assertThat(res.get().botUserId()).isEqualTo("extbot:bf-1");
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ExternalBotAdminServiceTest test`
Expected: COMPILE FAILURE — DTOs and `ExternalBotAdminService` do not exist.

- [ ] **Step 3: Create the DTOs**

Create `src/main/java/com/platform/chatservice/dto/CreateExternalBotRequest.java`:

```java
package com.platform.chatservice.dto;

public record CreateExternalBotRequest(
    String ownerUserId, String factoryBotId, String name, String avatarUrl) {}
```

Create `src/main/java/com/platform/chatservice/dto/ExternalBotResponse.java`:

```java
package com.platform.chatservice.dto;

public record ExternalBotResponse(
    String id,
    String botUserId,
    String factoryBotId,
    String ownerUserId,
    String name,
    String avatarUrl,
    boolean enabled) {}
```

Create `src/main/java/com/platform/chatservice/dto/AssistantResponse.java`:

```java
package com.platform.chatservice.dto;

public record AssistantResponse(String botUserId, String name, String avatarUrl) {}
```

- [ ] **Step 4: Create `ExternalBotAdminService`**

Create `src/main/java/com/platform/chatservice/service/ExternalBotAdminService.java`:

```java
package com.platform.chatservice.service;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Registers member→Bot Factory bot mappings and resolves a member's personal assistant. */
@Service
@RequiredArgsConstructor
public class ExternalBotAdminService {

  private final ExternalBotRepository repo;

  /**
   * Create or update the mapping for {@code factoryBotId}. The synthetic chat identity is derived
   * deterministically as {@code "extbot:" + factoryBotId} so re-registering is idempotent.
   */
  public ExternalBotResponse register(
      String ownerUserId, String factoryBotId, String name, String avatarUrl) {
    String botUserId = "extbot:" + factoryBotId;
    ExternalBot bot =
        repo.findByBotUserId(botUserId)
            .orElseGet(() -> ExternalBot.builder().botUserId(botUserId).build());
    bot.setOwnerUserId(ownerUserId);
    bot.setFactoryBotId(factoryBotId);
    bot.setName(name);
    bot.setAvatarUrl(avatarUrl);
    bot.setEnabled(true);
    return toResponse(repo.save(bot));
  }

  public Optional<ExternalBotResponse> findAssistantFor(String ownerUserId) {
    return repo.findByOwnerUserIdAndEnabledTrue(ownerUserId).map(this::toResponse);
  }

  private ExternalBotResponse toResponse(ExternalBot b) {
    return new ExternalBotResponse(
        b.getId(),
        b.getBotUserId(),
        b.getFactoryBotId(),
        b.getOwnerUserId(),
        b.getName(),
        b.getAvatarUrl(),
        b.isEnabled());
  }
}
```

- [ ] **Step 5: Create the controller**

Create `src/main/java/com/platform/chatservice/controller/ExternalBotController.java`:

```java
package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AssistantResponse;
import com.platform.chatservice.dto.CreateExternalBotRequest;
import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.ExternalBotAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExternalBotController {

  private final ExternalBotAdminService service;

  /** Register/update a member→Bot Factory bot mapping. Workspace admins only. */
  @PostMapping("/admin/external-bots")
  @PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")
  @ResponseStatus(HttpStatus.CREATED)
  public ExternalBotResponse register(@RequestBody CreateExternalBotRequest req) {
    return service.register(req.ownerUserId(), req.factoryBotId(), req.name(), req.avatarUrl());
  }

  /** The calling member's personal assistant identity, or 404 if none is registered. */
  @GetMapping("/assistant/me")
  public ResponseEntity<AssistantResponse> myAssistant() {
    String uid = currentUserId();
    return service
        .findAssistantFor(uid)
        .map(b -> ResponseEntity.ok(new AssistantResponse(b.botUserId(), b.name(), b.avatarUrl())))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q -Dtest=ExternalBotAdminServiceTest test`
Expected: PASS (2 tests).

- [ ] **Step 7: Full build + test suite (no regression)**

Run: `cd /Users/phong/projects/personal/platform/apps/server/chat-service && mvn -q test`
Expected: BUILD SUCCESS, all tests green. (Requires Docker for the Testcontainers MongoDB integration tests; if Docker is unavailable, run the unit tests added by this plan individually as above and note the integration tests were skipped.)

- [ ] **Step 8: Commit**

```bash
cd /Users/phong/projects/personal/platform
git add apps/server/chat-service/src/main/java/com/platform/chatservice/dto/CreateExternalBotRequest.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/dto/ExternalBotResponse.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/dto/AssistantResponse.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/service/ExternalBotAdminService.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ExternalBotController.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/ExternalBotAdminServiceTest.java
git commit -m "feat(chat): register external bots + resolve member assistant

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual end-to-end verification (after all tasks)

With infra up (`docker compose -f infra/docker-compose/compose.yml up -d`), chat-service running with `BOTFACTORY_BASE_URL` + `BOTFACTORY_WORKER_TOKEN` set to a reachable Bot Factory, and a valid member JWT:

1. **Register a bot** (as a `MANAGE_WORKSPACE` admin):
   ```bash
   curl -X POST http://localhost:8080/api/admin/external-bots \
     -H "Authorization: Bearer <admin-jwt>" -H "Content-Type: application/json" \
     -d '{"ownerUserId":"<memberUserId>","factoryBotId":"<botFactoryBotId>","name":"My Assistant"}'
   ```
2. **Resolve assistant** (as the member): `GET /api/assistant/me` → `{ botUserId: "extbot:<botFactoryBotId>", ... }`.
3. **Open the 1-1**: `POST /api/conversations` with `{ "participantId": "extbot:<botFactoryBotId>" }` → conversation `status: "accepted"`.
4. **Send a message** in that conversation (STOMP `/app/chat.send` or `POST /api/messages`). Within a few seconds an assistant message (`type:"ai"`, `senderId:"extbot:<botFactoryBotId>"`) is broadcast to `/topic/conversation/{id}`.
5. Confirm in Bot Factory that the conversation thread key is `pon:<conversationId>` (memory isolated per PON conversation).

## Out of scope (follow-up plans)

- **Phase 2:** group `@mention` routing (resolve a bot handle among group participants; `respondMode`).
- **Client UI (separate plan):** a "start chat with my assistant" entry + bot identity rendering in `apps/web` and `apps/client` (must satisfy `.claude/rules/sync.md`; use the `orchestrate-feature` skill).
- **Phase 4:** move `worker-token` to connector-service token vault; admin UI for managing bots; auto-provisioning a Bot Factory bot per member; two-side audit (`traceId` propagation into Bot Factory).
