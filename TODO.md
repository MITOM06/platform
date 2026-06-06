
# TODO — PON PROJECT
> **Workflow:** Gemini Code Assist (Planner/QC) ↔ Tech Lead (Bridge) ↔ Claude CLI (Coder/Tester)
> **Updated:** 2026-06-03
> **Note to Claude:** Phase 1 (chat core) is complete. Starting Phase 2 — AI layer. Read `.claude/rules/ai-service.md` and `docs/decisions.md` (ADR-007, ADR-008) before implementing any AI task.

---

## 🟢 SPRINT AI-1 — Basic Bot Member — DONE

> **Goal:** User types `@AI` in any conversation → AI replies with token-by-token streaming, renders markdown, has fallback on Claude error.
> **New service:** `apps/server/ai-service/` (NestJS/TypeScript, port 3002)
> **Transport:** Redis pub/sub (`ai:request` → ai-service → `ai:response:{convId}` → chat-service → STOMP → Flutter)
> **Reference:** `.claude/rules/ai-service.md`, `docs/decisions.md` ADR-007 & ADR-008

---

## 🔴 FIX NOTES — Sprint QC [2026-06-06] ✅ RESOLVED

### HIGH (file size limit & security gaps) ✅
- **[chat-service/MessageService.java]** ✅ Extracted to `MessageServiceHelper` (package-private `@Component`). MessageService now 467 lines (was 552).
- **[client/conversation_tile.dart]** ✅ `_showTileMenu` extracted to `conversation_tile_menu.dart` (`showConversationTileMenu`). conversation_tile.dart now 290 lines (was 448).
- **[chat-service/AuthChannelInterceptor.java]** ✅ `StompCommand.SUBSCRIBE` intercepted; extracts conversationId from `/topic/conversation/{id}`, calls `ConversationService.getParticipants()`, throws `MessageDeliveryException` if user is not a participant.

### MEDIUM (UX bug / mismatch) ✅
- **[client/chat_provider.dart]** ✅ `_aiMentionRe` updated to `RegExp(r'@(AI|ponai)\b', caseSensitive: false)` — word boundary prevents `@ai1` from triggering a stuck streaming placeholder.

---

### PHASE 1 — Infrastructure & Service Setup

### TASK AI-1.1 — Scaffold ai-service NestJS project `DONE`
#### IMPL NOTES
- NestJS project created at `apps/server/ai-service/` with pnpm
- Modules: `ai/`, `redis/`, `bot/`, `config/` all created
- Dependencies installed: `@anthropic-ai/sdk`, `ioredis`, `@nestjs/mongoose`, `mongoose`, `@nestjs/config`, `ioredis-mock` (dev)
- Multi-stage Dockerfile, `.env.example`, `nest-cli.json` all in place
- `pnpm build` → SUCCESS ✅

### TASK AI-1.2 — Bot user seed `DONE`
#### IMPL NOTES
- `bot/bot-seed.service.ts` created — implements `OnApplicationBootstrap`
- Upserts `{ _id: "ai-bot-000000000000000000000001", displayName: "PON AI", email: "ai@platform.internal", isBot: true, avatarUrl: null }` into `users` collection on boot
- Idempotent via `$setOnInsert` + `upsert: true` ✅

### TASK AI-1.3 — Redis pub/sub wiring — ai-service side `DONE`, chat-service side `DONE`
#### IMPL NOTES (ai-service side — DONE)
- `redis/redis.module.ts`: exports `REDIS_SUBSCRIBER` + `REDIS_PUBLISHER` (two separate ioredis instances)
- `redis/redis-subscriber.service.ts`: subscribes to `ai:request`, parses JSON, calls `AiService.handleRequest()`
- `redis/redis-publisher.service.ts`: `publish(conversationId, payload)` → `PUBLISH ai:response:{convId}`
#### SPEC (chat-service side — PENDING)
- Create `AiRedisPublisher.java` service: inject `StringRedisTemplate`, method `publishAiRequest(String json)` → `redisTemplate.convertAndSend("ai:request", json)`
- Create `AiResponseListener.java`: implement Spring `MessageListener`, register with `RedisMessageListenerContainer` using topic pattern `ai:response:*`
- On message: parse JSON `{type, chunk?, fullContent?, error?}` → forward via `SimpMessagingTemplate` to `/topic/conversation/{convId}` with `senderId = "ai-bot-000000000000000000000001"`
- On `AI_STREAM_DONE`: also call `messageService.saveAiMessage(convId, fullContent)`
- Register `RedisMessageListenerContainer` bean in a `@Configuration` class if not already present

### TASK AI-1.4 — Anthropic Claude SDK — config `DONE`, streaming `DONE`
#### IMPL NOTES (config — DONE)
- `config/configuration.ts`: typed config via `registerAs('config', ...)` — anthropic.apiKey, anthropic.model, anthropic.fallbackModel, bot.userId, bot.displayName, redisChannels.*
- `ai/ai.service.ts`: `Anthropic` client instantiated with `apiKey` from config
- `AiService.handleRequest()` is a **stub** — logs the request but does not call Claude yet
#### SPEC (streaming — PENDING, implement in TASK AI-1.6)

---

### PHASE 2 — Core AI Logic

### TASK AI-1.5 — Detect @AI mention in chat-service `DONE`
#### SPEC
- **Files to modify:** `ChatController.java`, `MessageController.java`, `MessageService.java`
- In `ChatController.send()` (STOMP) and `MessageController.sendMessage()` (REST): after `messageService.sendMessage()` returns, if `dto.getContent()` matches regex `(?i)@(AI|ponai)\b` → call `aiRedisPublisher.publishAiRequest(payload)` **asynchronously** (do NOT block the response).
- Build payload JSON: `{ conversationId, userId, displayName: principal.getName(), content: stripped_content, history: last10messages }`. Strip `@AI` from content before sending.
- Fetch history: call `messageRepository.findTop10ByConversationIdOrderByCreatedAtDesc(convId)`, map to `[{role, content}]` (senderId equals bot userId → role `assistant`, otherwise `user`). Reverse to chronological order.
- **New file:** `service/AiRedisPublisher.java` — `@Service`, inject `StringRedisTemplate`, method `publishAiRequest(String conversationId, String userId, String displayName, String content, List<Map<String,String>> history)` — serializes to JSON via `ObjectMapper`, publishes to `"ai:request"`.
- **Test:** `ChatControllerTest.java` — mock `AiRedisPublisher`, verify `publishAiRequest` called when content contains `@AI`, not called when it doesn't.

### TASK AI-1.6 — Claude streaming in ai-service `DONE`
#### SPEC
- **File to modify:** `apps/server/ai-service/src/ai/ai.service.ts` — replace stub `handleRequest()` with full implementation:
  1. Build system prompt: `"You are PON AI, an intelligent assistant in the PON chat platform. You are helping {displayName}. Be helpful, concise, and friendly. Respond in the same language the user writes in."`
  2. Map `payload.history` → `Anthropic.MessageParam[]` (role `user`/`assistant`, content string)
  3. Call `this.anthropic.messages.stream({ model: primaryModel, max_tokens: 2048, system, messages: [...history, {role:'user', content}] })`
  4. Accumulate `fullText = ''`. For each `chunk`: if `chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta'` → `fullText += chunk.delta.text`, call `await this.publisher.publish(convId, { type: 'AI_STREAM_CHUNK', chunk: chunk.delta.text })`
  5. After loop: `await this.publisher.publish(convId, { type: 'AI_STREAM_DONE', fullContent: fullText })`
- **Error & fallback:** wrap entire stream in try/catch. On error: if no chunks published yet → retry once with `fallbackModel` (same logic). If retry also fails → `await this.publisher.publish(convId, { type: 'AI_STREAM_ERROR', error: 'AI is temporarily unavailable.' })`. Log error with `this.logger.error()`.
- **Test:** `src/ai/ai.service.spec.ts` — mock `@anthropic-ai/sdk` and `RedisPublisherService`. Test: (1) chunks published correctly in order, (2) primary error triggers fallback retry, (3) both fail → publishes AI_STREAM_ERROR.

### TASK AI-1.7 — Forward chunks via STOMP (chat-service) `DONE`
#### SPEC
- **New file:** `service/AiResponseListener.java` — `@Component`, implement `org.springframework.data.redis.connection.MessageListener`
- Constructor-inject `SimpMessagingTemplate`, `MessageService`, `ObjectMapper`
- `onMessage()`: deserialize JSON `{ type, chunk?, fullContent?, error?, conversationId }` — NOTE: include `conversationId` in the payload published by ai-service so listener can route correctly.
- If `AI_STREAM_CHUNK` → `messagingTemplate.convertAndSend("/topic/conversation/" + convId, Map.of("type","AI_STREAM_CHUNK","chunk",chunk,"senderId",BOT_USER_ID))`
- If `AI_STREAM_DONE` → call `messageService.saveAiMessage(convId, fullContent)`, then broadcast `Map.of("type","AI_STREAM_DONE","senderId",BOT_USER_ID,"conversationId",convId)`
- If `AI_STREAM_ERROR` → broadcast `Map.of("type","AI_STREAM_ERROR","error",error,"senderId",BOT_USER_ID)`
- **New file:** `config/RedisListenerConfig.java` — `@Configuration`, define `RedisMessageListenerContainer` bean, register `AiResponseListener` with `PatternTopic("ai:response:*")`
- **Constant:** `AI_BOT_USER_ID = "ai-bot-000000000000000000000001"` — define in a `AiConstants.java` or as a static field in `AiResponseListener`
- **Update `ai-service` publisher:** add `conversationId` field to every published payload so listener can extract it without parsing the channel name.
- **Test:** `AiResponseListenerTest.java` — mock `SimpMessagingTemplate` + `MessageService`, verify correct `convertAndSend` call for each event type.

### TASK AI-1.8 — Persist AI message to MongoDB `DONE`
#### SPEC
- **File to modify:** `service/MessageService.java`
- Add method `saveAiMessage(String conversationId, String content)`:
  - Build `Message` with `senderId = "ai-bot-000000000000000000000001"`, `type = "ai"`, `content`, `readBy = []`, `createdAt = Instant.now()`
  - `messageRepository.save(message)`
  - Update conversation `lastMessage` and `lastMessageAt` via `conversationRepository`
  - Broadcast `MessageResponse` to `/topic/conversation/{convId}` via STOMP (same pattern as regular send)
- **File to modify:** `model/Message.java` — add `"ai"` as valid type in the inline comment (no validation annotation, just documentation)
- **Test:** Add unit test in `MessageServiceTest.java` verifying `saveAiMessage` saves with correct fields and updates conversation.

---

### PHASE 3 — Flutter UI

### TASK AI-1.9 — STOMP listener for AI_STREAM events `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/data/stomp_service.dart`
  - In the existing conversation topic subscription handler, add cases for `type == "AI_STREAM_CHUNK"`, `"AI_STREAM_DONE"`, `"AI_STREAM_ERROR"` — emit to a new `StreamController<Map<String,dynamic>> _aiStreamCtrl` (broadcast)
  - Expose `Stream<Map<String,dynamic>> get aiStreamEvents => _aiStreamCtrl.stream`
- **File:** `apps/client/lib/features/chat/domain/chat_state.dart`
  - Add to `MessageModel`: `final bool isStreaming; final bool isThinking;` (default `false`)
  - Add `copyWith` fields for both
- **File:** `apps/client/lib/features/chat/domain/chat_provider.dart` (`ChatNotifier`)
  - Subscribe to `stompService.aiStreamEvents` in `build()` or a dedicated `_listenAiStream()` method
  - On `AI_STREAM_CHUNK`: find message in state by `senderId == AI_BOT_USER_ID && isStreaming == true`, update content by appending chunk, set `isThinking = false`
  - On `AI_STREAM_DONE`: finalize — set `isStreaming = false`, `isThinking = false`
  - On `AI_STREAM_ERROR`: set content = `context.l10n.aiError` (use hardcoded fallback string since no context available), `isStreaming = false`
- When user sends a message containing `@AI`: immediately insert a placeholder `MessageModel(id: 'ai-pending', senderId: AI_BOT_USER_ID, content: '', type: 'ai', isStreaming: true, isThinking: true, createdAt: DateTime.now())` into state before the STOMP send.
- On `AI_STREAM_DONE`: replace placeholder with the real persisted message (match by senderId+isStreaming, update with real content and `isStreaming=false`).

### TASK AI-1.10 — Streaming message bubble `DONE`
#### SPEC
- **New file:** `apps/client/lib/features/chat/ui/widgets/streaming_ai_bubble.dart`
  - `StreamingAiBubble(String content, bool isThinking)` — StatefulWidget
  - If `isThinking`: show `Row` with 3 animated dots (use `AnimationController` with repeat, stagger opacity 0→1→0)
  - If not thinking: show `flutter_markdown` `MarkdownBody(data: content)` + blinking `|` cursor (Timer.periodic 500ms toggles `_showCursor`)
  - Dispose timer and animation controller properly
- **File:** `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
  - Add case: if `message.type == 'ai' && message.isStreaming` → render `StreamingAiBubble(content: message.content, isThinking: message.isThinking)`
  - If `message.type == 'ai' && !message.isStreaming` → render `MarkdownBody` (same as current markdown path)

### TASK AI-1.11 — AI bot bubble distinct style `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
  - AI bubble background: `Color(0xFF2D1B69)` (deep purple, neon-compatible) instead of the regular received bubble color
  - AI avatar: `CircleAvatar` with `Icons.smart_toy` icon (purple-tinted), NOT initials
  - Add "AI" badge: small `Container` (8×8 px circle, purple) overlaid at bottom-right of avatar using `Stack`
  - Long-press action sheet: exclude "Edit" and "Recall" options when `message.senderId == AI_BOT_USER_ID`

### TASK AI-1.12 — AI bot identity in app `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/ui/new_conversation_screen.dart` (or wherever user list is shown)
  - The AI bot user (`isBot: true`) should appear at the top of the user list with an "AI" badge chip next to its name
  - Tapping it creates a DM conversation with bot (existing `POST /api/conversations` flow works unchanged)
- **File:** `apps/client/lib/features/chat/ui/widgets/chat_app_bar.dart`
  - If the conversation's only other participant is the bot user ID → hide call/video buttons, show subtitle "AI Assistant" instead of online status
- **File:** `apps/client/lib/features/chat/ui/widgets/conversation_tile.dart`
  - If DM with bot: show `Icons.smart_toy` icon instead of avatar initials
- **i18n:** Add to all 7 ARB files: `"aiAssistant": "AI Assistant"`, `"startChatWithAI": "Chat with PON AI"`, `"aiThinking": "AI is thinking..."`, `"aiError": "AI is temporarily unavailable. Please try again."`, `"aiErrorRetry": "Retry"`, `"aiMessageDeleted": "Message deleted"`
- Run `flutter gen-l10n` after adding keys

---

### PHASE 4 — Error Handling, i18n & Tests

### TASK AI-1.13 — Complete i18n + error bubble style `DONE`
#### SPEC
- Verify all 6 i18n keys from TASK AI-1.12 are present in all 7 ARB files (`en, vi, zh, ja, ko, es, fr`)
- **File:** `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
  - AI error state: if `message.type == 'ai' && content == aiError string` → wrap in light red container (`Color(0xFF3D1515)`) with `Icons.warning_amber` prefix
- Run `flutter gen-l10n` → `flutter analyze` → No issues

### TASK AI-1.14 — End-to-end tests & verification `DONE`
#### SPEC
- **ai-service:** `src/ai/ai.service.spec.ts` must cover: (1) chunks published in correct order, (2) primary model error → fallback triggered, (3) fallback error → AI_STREAM_ERROR published. Run `pnpm test` → all pass.
- **chat-service:** `AiResponseListenerTest.java` and update `MessageServiceTest.java` with `saveAiMessage` test. Run `mvn test` → all pass.
- **Flutter:** `flutter analyze` → 0 issues. `flutter test` → all pass.
- **Append to QA LOG** in this file with results.

---

## 🧪 QA LOG

### [2026-06-06] SPRINT AI-2 (TASKS AI-2.1 – AI-2.7) → ✅ DONE
- **AI-2.1 — Expand & clean history payload:**
  - `MessageService.getAiHistory` updated: limit 10 → 20; excludes `voice/file/sticker/system/call_log` types; strips `@AI`/`@ponai` via `Pattern.compile`; trims blank content entries.
  - New static fields: `AI_HISTORY_SKIP_TYPES`, `AI_MENTION_STRIP`.
  - Test added in `MessageServiceTest`: `getAiHistory_ExcludesNonTextTypes_AndMapsBotToAssistant` verifies type filtering, bot→assistant role mapping, @AI stripping.
- **AI-2.2 — `ai_memories` collection + MemoryService (ai-service):**
  - `src/memory/ai-memory.schema.ts`: Mongoose schema with `conversationId, userId, summary, keyFacts, messageCount, updatedAt`; compound unique index `{conversationId,userId}`.
  - `src/memory/memory.service.ts`: `getMemory`, `upsertMemory`, `deleteMemory`, `incrementMessageCount` (upsert+$inc).
  - `src/memory/memory.module.ts`: exports `MemoryService`.
  - `src/app.module.ts` + `src/ai/ai.module.ts`: import `MemoryModule`.
- **AI-2.3 — Auto-summarization trigger:**
  - `AiService.handleRequest()`: after stream, calls `incrementMessageCount`; if `count % 20 === 0` fires `_generateSummary(conversationId, userId, history, count)` async (fire-and-forget, `.catch` logged).
  - `_generateSummary`: non-streaming `messages.create`, extracts summary + `FACTS: [...]`, calls `upsertMemory`.
- **AI-2.4 — Memory injected into system prompt:**
  - `handleRequest()` calls `getMemory(conversationId)` before building system prompt.
  - If memory with non-empty summary exists: appends `## Memory from previous conversations:\n{summary}` + key facts list.
- **AI-2.5 — Memory REST API (chat-service):**
  - `model/AiMemory.java`: `@Document(collection="ai_memories")` mapping ai-service schema.
  - `repository/AiMemoryRepository.java`: `findByConversationId`, `findByUserId`, `deleteByConversationId`.
  - `dto/AiMemoryResponse.java`: record `(conversationId, summary, keyFacts, messageCount, updatedAt)`.
  - `controller/AiMemoryController.java`: `GET /api/ai/memories`, `GET /api/ai/memories/{convId}` (ownership check), `DELETE /api/ai/memories/{convId}` (403 wrong user, 404 not found, 204 success).
- **AI-2.6 — Flutter AI Memory screen:**
  - `data/ai_memory_repository.dart`: `AiMemoryRepository` + `aiMemoryRepositoryProvider` (chatDio).
  - `domain/ai_memory_model.dart`: `AiMemoryModel` with `fromJson`.
  - `domain/ai_memory_provider.dart`: `AiMemoriesNotifier` (AsyncNotifier) + `aiMemoriesProvider`; `deleteMemory` does optimistic state removal.
  - `ui/ai_memory_screen.dart` (192 lines): list of memories with summary, key facts (up to 3), message count chip, date; empty state with `Icons.psychology_outlined`; long-press or delete icon → confirm dialog.
  - Route `/ai-memories` added to `app_router.dart`.
  - `ChatScreenAppBar`: `PopupMenuButton` with "View Memory" action when `isAiConversation`.
- **AI-2.7 — i18n + Tests:**
  - 7 new i18n keys added to all 7 ARB files: `aiMemoryTitle, aiMemoryEmptyState, aiMemoryDeleteConfirm, aiMemoryDeleted, aiMemoryUpdated{date}, aiMemoryFacts, viewAiMemory`. `flutter gen-l10n` regenerated.
  - `memory.service.spec.ts` (5 tests): `getMemory` found/null, `upsertMemory`, `deleteMemory`, `incrementMessageCount`.
  - `ai.service.spec.ts` (extended to 10 tests): memory injection into system prompt when memory exists/absent; `_generateSummary` called at count=20 and count=40; not called at non-multiples.
  - `AiMemoryControllerTest.java` (6 tests): GET returns user memories, GET ownership, DELETE 204, DELETE 403 wrong user, DELETE 404 not found.
- **Tests:**
  - `mvn test` → **BUILD SUCCESS, 73/73** (AiMemoryControllerTest 6, MessageServiceTest 31 incl. new AI-2.1 test, all 66 prior tests pass).
  - `pnpm build` → SUCCESS; `pnpm test` → **13/13** (memory.service.spec.ts 5, ai.service.spec.ts 10 [3 original + 7 new]).
  - `flutter gen-l10n` → clean; `flutter analyze` → **1 pre-existing info** (chat_provider.dart:283, unchanged); `flutter test` → **All tests passed**.
- **Files created (ai-service):** `src/memory/ai-memory.schema.ts`, `src/memory/memory.service.ts`, `src/memory/memory.module.ts`, `src/memory/memory.service.spec.ts`.
- **Files modified (ai-service):** `src/ai/ai.service.ts`, `src/ai/ai.service.spec.ts`, `src/ai/ai.module.ts`, `src/app.module.ts`.
- **Files created (chat-service):** `model/AiMemory.java`, `repository/AiMemoryRepository.java`, `dto/AiMemoryResponse.java`, `controller/AiMemoryController.java`, `controller/AiMemoryControllerTest.java`.
- **Files modified (chat-service):** `service/MessageService.java`, `service/MessageServiceTest.java`.
- **Files created (Flutter):** `data/ai_memory_repository.dart`, `domain/ai_memory_model.dart`, `domain/ai_memory_provider.dart`, `ui/ai_memory_screen.dart`.
- **Files modified (Flutter):** `core/router/app_router.dart`, `ui/widgets/chat_app_bar.dart`, all 7 `l10n/app_*.arb`.

### [2026-06-06] SPRINT QC FIX NOTES → ✅ RESOLVED
- **chat-service/MessageService.java refactor:** Extracted 7 helper methods (`isBlockedBetween`, `blocks`, `requireParticipantMessage`, `buildReplyPreview`, `snippet`, `parseMentions`, `lookupDisplayName`) into new package-private `MessageServiceHelper` (`@Component`, `@RequiredArgsConstructor`). `MessageService` reduced from 552 → 467 lines.
  - `MessageServiceTest` updated: `userBlockRepository` mock replaced with `messageServiceHelper` mock; block tests stub `messageServiceHelper.isBlockedBetween()`; mention test stubs `messageServiceHelper.parseMentions()`.
- **client/conversation_tile.dart refactor:** `_showTileMenu` (156 lines) extracted to `conversation_tile_menu.dart` as `showConversationTileMenu(context, ref, conv)`. File reduced from 448 → 290 lines. Unused `friends_repository.dart` and `friends_provider.dart` imports removed.
- **chat-service/AuthChannelInterceptor.java security fix:** `StompCommand.SUBSCRIBE` handling added. Extracts `conversationId` from destination prefix `/topic/conversation/` (handles both base and sub-paths like `/typing`). Calls `conversationService.getParticipants(conversationId)`, throws `MessageDeliveryException("Unauthorized subscription")` if user is not a participant.
- **client/chat_provider.dart regex fix:** `_aiMentionRe` changed to `RegExp(r'@(AI|ponai)\b', caseSensitive: false)` — adds `\b` word boundary to match backend regex `(?i)@(AI|ponai)\b`, preventing `@ai1` from triggering a stuck streaming placeholder.
- **Tests:** `mvn test` → **BUILD SUCCESS, 66/66**. `flutter analyze` → **1 pre-existing info** (chat_provider.dart:283, unchanged). `flutter test` → **All tests passed**.
- **Files created (chat-service):** `service/MessageServiceHelper.java`.
- **Files modified (chat-service):** `service/MessageService.java`, `service/MessageServiceTest.java`, `security/AuthChannelInterceptor.java`.
- **Files created (Flutter):** `ui/widgets/conversation_tile_menu.dart`.
- **Files modified (Flutter):** `ui/widgets/conversation_tile.dart`, `domain/chat_provider.dart`.

### [2026-06-04] SPRINT AI-1 (TASKS AI-1.3 chat-service, AI-1.5 – AI-1.14) → ✅ DONE
- **AI-1.3 chat-service side:** Created `AiRedisPublisher.java`, `AiResponseListener.java`, `RedisListenerConfig.java`, `AiConstants.java`, `AiRequestPayload.java`.
  - `AiResponseListener` subscribes to `ai:response:*` pattern, handles `AI_STREAM_CHUNK/DONE/ERROR`, broadcasts via `SimpMessagingTemplate`, calls `saveAiMessage` on DONE.
  - `RedisListenerConfig` registers `RedisMessageListenerContainer` bean with `PatternTopic("ai:response:*")`.
- **AI-1.5 @AI detection:** `ChatController.send()` and `MessageController.sendMessage()` detect `(?i)@(AI|ponai)\b`, fire async `CompletableFuture` to publish to Redis (non-blocking).
- **AI-1.6 Claude streaming:** `AiService.handleRequest()` fully implemented with `messages.stream()` loop, fallback model retry on error, `AI_STREAM_ERROR` on double failure.
  - `RedisPublisherService.publish()` now merges `conversationId` into every payload.
- **AI-1.7 STOMP forward:** `AiResponseListener.onMessage()` broadcasts `AI_STREAM_CHUNK/DONE/ERROR` events + full `MessageResponse` on DONE.
- **AI-1.8 Persist AI message:** `MessageService.saveAiMessage()` saves with `senderId=AI_BOT_USER_ID`, `type="ai"`, broadcasts `MessageResponse` via STOMP. `Message.type` comment updated to include "ai".
- **AI-1.9 STOMP listener Flutter:** `StompService._aiStreamCtrl` added; `AI_STREAM_CHUNK/DONE/ERROR` cases handled in `_doSubscribeConversation`. `ChatNotifier._onAiStreamEvent` accumulates chunks, finalizes on DONE, sets error sentinel on ERROR. Streaming placeholder inserted in `sendMessage` when `@AI` detected.
- **AI-1.10 Streaming bubble:** `StreamingAiBubble` (animated dots thinking indicator + blinking cursor), `FinalizedAiBubble` (MarkdownBody). `MessageBubble` delegates to these for `type=='ai'`.
- **AI-1.11 AI bot bubble style:** Deep purple background `Color(0xFF2D1B69)`, error state `Color(0xFF3D1515)` with warning icon. `_AiBotAvatar` widget with `Icons.smart_toy` + small "AI" badge. "PON AI" label above AI bubbles.
- **AI-1.12 AI bot identity:** `ConversationTile` shows `_AiBotTileAvatar` with robot icon for bot DMs. `ChatScreenAppBar` hides call/video buttons for bot, shows "AI Assistant" subtitle. `NewConversationScreen` shows `_AiBotTile` at top for quick AI chat creation.
- **AI-1.13 i18n + error bubble:** 6 keys added to all 7 ARB files: `aiAssistant`, `startChatWithAI`, `aiThinking`, `aiError`, `aiErrorRetry`, `aiMessageDeleted`. `flutter gen-l10n` regenerated. Error bubble shows `Icons.warning_amber_rounded` + red background.
- **AI-1.14 Tests:**
  - chat-service: `mvn test` → **BUILD SUCCESS, 66/66** (AiResponseListenerTest 4, MessageServiceTest 30 incl. `saveAiMessage` test, ChatControllerTest 6 incl. 2 new `@AI` trigger tests).
  - ai-service: `pnpm build` → SUCCESS; `pnpm test` → **3/3** (chunks in order, fallback retry, error on both fail).
  - Flutter: `flutter gen-l10n` → clean; `flutter analyze` → **1 pre-existing info** (chat_provider.dart:283, pre-existing, unrelated); `flutter test` → **All tests passed**.
- **Files modified (chat-service):** `model/Message.java`, `service/MessageService.java`, `controller/ChatController.java`, `controller/MessageController.java`, `service/MessageServiceTest.java`, `controller/ChatControllerTest.java`.
- **Files created (chat-service):** `service/AiConstants.java`, `service/AiRedisPublisher.java`, `service/AiResponseListener.java`, `config/RedisListenerConfig.java`, `dto/AiRequestPayload.java`, `service/AiResponseListenerTest.java`.
- **Files modified (ai-service):** `src/ai/ai.service.ts`, `src/redis/redis-publisher.service.ts`.
- **Files created (ai-service):** `src/ai/ai.service.spec.ts`.
- **Files modified (Flutter):** `domain/chat_state.dart`, `data/stomp_service.dart`, `domain/chat_provider.dart`, `ui/widgets/message_bubble.dart`, `ui/widgets/chat_app_bar.dart`, `ui/widgets/conversation_tile.dart`, `ui/new_conversation_screen.dart`, all 7 `l10n/app_*.arb`.
- **Files created (Flutter):** `ui/widgets/streaming_ai_bubble.dart`.

### [2026-06-03] TASK AI-1.1 — Scaffold ai-service → ✅ DONE
- NestJS project created, all modules scaffolded, `pnpm build` SUCCESS
- Bot seed, Redis pub/sub (ai-service side), config, and AiService skeleton complete
- `AiService.handleRequest()` is a stub — streaming to be implemented in AI-1.6

---

### PHASE 2 — Core AI Logic

### TASK AI-1.5 — Detect @AI mention in chat-service `PENDING`
#### SPEC
- **Backend (chat-service):** In `ChatController.send()` (STOMP handler): after `messageService.sendMessage()`, check if `content` matches regex `/@(AI|ai|ponai|PON AI)\b/`. If match → async publish to Redis `ai:request`. MUST NOT block STOMP response.
- **Backend (chat-service):** Same logic for REST `MessageController.sendMessage()`.
- **Backend (chat-service):** Create `AiRequestPayload` record DTO: `{ conversationId, userId, displayName, content, history }`.
- **Backend (chat-service):** Create `AiRedisPublisher` service (inject `StringRedisTemplate`): `publishAiRequest(payload)` — serialize JSON, publish to `ai:request` channel.
- **Backend (chat-service):** Fetch `history`: call `messageService.getMessages(userId, conversationId, null, 10)`, map to `[{role, content}]` (role: `ai-bot` userId → `assistant`, others → `user`).
- **Test:** Send message with `@AI` via STOMP → verify Redis publish is called (mock `StringRedisTemplate`).

### TASK AI-1.6 — Claude streaming in ai-service `PENDING`
#### SPEC
- **Backend (ai-service):** `AiService.handleRequest(payload)`:
  1. Build `systemPrompt` from template in `.claude/rules/ai-service.md`
  2. Map `payload.history` → Anthropic message format
  3. Call `this.anthropic.messages.stream({ model, max_tokens: 2048, system, messages })`
  4. Iterate `for await (const chunk of stream)`: if `chunk.type === 'content_block_delta'` → accumulate + publish `AI_STREAM_CHUNK`
  5. After stream ends: publish `AI_STREAM_DONE` with `fullContent`
- **Error handling:** Wrap in try/catch — on error → publish `AI_STREAM_ERROR`
- **Test:** Unit test with mock stream, verify correct sequence CHUNK → DONE.

### TASK AI-1.7 — Forward chunks via STOMP (chat-service) `PENDING`
#### SPEC
- **Backend (chat-service):** Create `AiResponseListener` service (Spring Data Redis `MessageListener`). Register in `RedisMessageListenerContainer` with pattern `ai:response:*`.
- **Backend (chat-service):** On message received: parse JSON → if `AI_STREAM_CHUNK` → `messagingTemplate.convertAndSend("/topic/conversation/{id}", payload with senderId=AI_BOT_USER_ID)`. If `AI_STREAM_DONE` → save full message to MongoDB (`messageService.saveAiMessage(conversationId, fullContent)`), broadcast final event.
- **Backend (chat-service):** Add method `MessageService.saveAiMessage(conversationId, content)` — save with `senderId = AI_BOT_USER_ID`, `type = "ai"`.
- **Test:** Manually publish to `ai:response:testConvId` → verify STOMP broadcast.

### TASK AI-1.8 — Persist AI message to MongoDB `PENDING`
#### SPEC
- **Backend (chat-service):** `MessageService.saveAiMessage()`: create `Message` with `senderId = AI_BOT_USER_ID`, `type = "ai"`, `content = fullContent`. Save via `messageRepository.save()`. Update conversation `lastMessage`.
- **Data model:** Add `"ai"` to the `type` enum of `Message` model (current types: `"text"`, `"image"`, `"video"`, `"system"`, `"call_log"`, `"file"`, `"voice"`, `"sticker"`).
- **Test:** After AI_STREAM_DONE, verify message appears in `platform.messages` with correct fields.

---

### PHASE 3 — Flutter UI

### TASK AI-1.9 — STOMP listener for AI_STREAM events `PENDING`
#### SPEC
- **Frontend (Flutter):** In `StompService`, add handler for events with `type: "AI_STREAM_CHUNK"`, `"AI_STREAM_DONE"`, `"AI_STREAM_ERROR"` from `/topic/conversation/{id}`.
- **Frontend (Flutter):** In `ChatNotifier`: on `AI_STREAM_CHUNK` → find or create "pending AI message" in state, append chunk to `content`. On `AI_STREAM_DONE` → finalize message (set `isStreaming = false`). On `AI_STREAM_ERROR` → set error content.
- **Frontend (Flutter):** Add `isStreaming: bool` to `MessageModel`.
- **Test:** Unit test ChatNotifier: receive sequence CHUNK + CHUNK + DONE → verify final content is correct.

### TASK AI-1.10 — Streaming message bubble `PENDING`
#### SPEC
- **Frontend (Flutter):** In `MessageBubble`: if `message.type == "ai"` and `message.isStreaming == true` → render `StreamingAiBubble` widget.
- **Frontend (Flutter):** Create `widgets/streaming_ai_bubble.dart`: display current text + blinking cursor (`|`) at end, animate with `Timer.periodic(500ms)` toggling visibility.
- **Frontend (Flutter):** When `isStreaming = false` → render normally using `flutter_markdown` (already available).
- **Test:** Widget test: verify cursor shown when `isStreaming=true`, hidden when `false`.

### TASK AI-1.11 — "AI is thinking..." indicator `PENDING`
#### SPEC
- **Frontend (Flutter):** In `ChatNotifier`: when user sends message with `@AI` → immediately add a temporary `MessageModel` `{ senderId: AI_BOT_USER_ID, content: "", type: "ai", isStreaming: true, isThinking: true }` to state.
- **Frontend (Flutter):** Add `isThinking: bool` to `MessageModel`.
- **Frontend (Flutter):** `StreamingAiBubble`: if `isThinking == true` → show 3-dot loading animation instead of text.
- **Frontend (Flutter):** On first `AI_STREAM_CHUNK` received → set `isThinking = false`, start showing text.
- **i18n:** Add key `aiThinking` to all 7 ARB files.

### TASK AI-1.12 — AI bot bubble distinct style `PENDING`
#### SPEC
- **Frontend (Flutter):** In `MessageBubble`: if `senderId == AI_BOT_USER_ID` → use different bubble color (light purple or purple-to-teal gradient matching current neon theme).
- **Frontend (Flutter):** AI bot avatar: show robot icon (`Icons.smart_toy`) instead of initials. Add small "AI" badge (purple) at bottom-right of avatar.
- **Frontend (Flutter):** AI messages do NOT show "Edit" or "Recall" in long-press menu. Reply/React/Forward remain available.
- **Test:** Widget test: verify AI bubble has different color than user bubble.

### TASK AI-1.13 — AI bot identity in conversation `PENDING`
#### SPEC
- **Frontend (Flutter):** In `new_conversation_screen.dart` or equivalent: add option to create DM with AI bot (shown in user list with "AI" badge).
- **Frontend (Flutter):** When opening conversation with AI bot: hide call button (voice/video), hide "last seen", profile shows name + "AI Assistant" subtitle.
- **Frontend (Flutter):** In `ConversationTile`: if 1-1 conversation with bot → show AI icon instead of avatar.
- **i18n:** Add keys `aiAssistant`, `startChatWithAI` to all 7 ARB files.

---

### PHASE 4 — Error Handling & Polish

### TASK AI-1.14 — Error handling & fallback model `PENDING`
#### SPEC
- **Backend (ai-service):** In `AiService.handleRequest()`: wrap Claude API call in try/catch. On error with primary model (status 529, "overloaded") → retry once with `ANTHROPIC_FALLBACK_MODEL`. On continued failure → publish `AI_STREAM_ERROR`.
- **Backend (ai-service):** Log errors with NestJS `Logger` (model used, error message, conversationId).
- **Frontend (Flutter):** On `AI_STREAM_ERROR` → set message content = localized error string, `isStreaming = false`, show error style in bubble (light red background, warning icon).
- **i18n:** Add keys `aiError`, `aiErrorRetry` to all 7 ARB files.
- **Test:** Unit test: mock Claude throwing error → verify `AI_STREAM_ERROR` published, fallback attempted.

### TASK AI-1.15 — Complete i18n for AI features `PENDING`
#### SPEC
- **Frontend (Flutter):** Consolidate all new keys from TASK AI-1.11, AI-1.13, AI-1.14. Ensure all 7 ARBs have: `aiThinking`, `aiError`, `aiErrorRetry`, `aiAssistant`, `startChatWithAI`, `aiMessageDeleted`.
- **Frontend (Flutter):** Run `flutter gen-l10n` → verify no missing keys.
- **Test:** `flutter analyze` → No issues found.

### TASK AI-1.16 — End-to-end test & verification `PENDING`
#### SPEC
- **Backend (ai-service):** Write `ai.service.spec.ts` — mock Anthropic SDK, test: (1) stream chunks are published correctly, (2) error triggers fallback, (3) fallback failure → publishes AI_STREAM_ERROR.
- **Backend (chat-service):** Write `AiResponseListenerTest.java` — mock `SimpMessagingTemplate`, verify STOMP broadcast is correct when receiving Redis message.
- **Full flow test:** `mvn test` (chat-service) → all pass. `pnpm test` (ai-service) → all pass. `flutter analyze && flutter test` → clean.
- **Manual smoke test checklist:**
  - [ ] Send `@AI hello` in DM → see thinking indicator → text appears token by token
  - [ ] Send `@AI explain what **markdown** is` → verify bold renders correctly
  - [ ] Send in group chat → AI replies to correct conversation
  - [ ] Disable ANTHROPIC_API_KEY → verify error message shown instead of crash

---

## 🧪 QA LOG

*(Will be appended after implementation)*


---

## 🟢 SPRINT 12 — Core Message Enhancements & Pagination — DONE

### TASK 45 — Edit Message Feature `DONE`
#### SPEC
- **Data model (BE):** Add `editedAt` (Date/timestamp) to `Message` schema/model.
- **Backend:** Create `PUT /api/messages/{id}` endpoint to update `content` and set `editedAt`. Verify the user is the sender before updating. Broadcast the edited message via STOMP (`MESSAGE_UPDATED` event).
- **Frontend:** Implement long-press on a message bubble (sent by me) to show a context menu with "Edit". When selected, show the message in the input bar. Upon saving, call the PUT API. Display an `(edited)` text next to the timestamp for modified messages.
- **Test:** Edit a message, check if the UI updates instantly for both users and shows the edited tag.

### TASK 46 — General File Upload (PDF, DOC, ZIP) `DONE`
#### SPEC
- **Backend:** Update `UploadController` to accept application formats (PDF, DOCX, ZIP, etc.), not just `image/*` and `video/*`. Ensure GridFS saves correct content types.
- **Frontend:** Integrate a file picker (e.g., `file_picker` package). In `ChatScreen`, add an attachment icon to pick general documents. Render a generic "File Bubble" (showing filename, size, and a download icon) instead of an image preview when the type is a document.
- **Test:** Upload a PDF file, verify the receiver sees the file card and can download it.

### TASK 47 — Cursor-based Pagination for Messages `DONE`
#### SPEC
- **Backend:** Refactor `MessageService.getMessages` to use cursor-based pagination (e.g., passing `beforeMessageId` or `beforeTimestamp` instead of `page`). This prevents message jumping or duplication when new messages arrive while scrolling up.
- **Frontend:** Update `chat_repository.dart` and `ChatNotifier` to track the oldest `messageId` and pass it to the API during `loadMore()`.
- **Test:** Scroll up to load old messages while the other user sends new messages. Verify the scroll position is stable and no duplicate messages appear.

### TASK 48 — Link Preview (OG Unfurl) `DONE`
#### SPEC
- **Frontend:** When rendering text messages containing URLs, parse the URL and fetch Open Graph (OG) metadata (title, description, thumbnail image). Use a package like `any_link_preview` or `flutter_link_previewer`. If CORS blocks client-side fetching, create a `GET /api/utils/link-preview?url=` in the Backend.
- **Test:** Send a link (e.g., youtube.com), verify a rich card preview appears below the text.

---

## 🟢 SPRINT 13 — Mentions, Search & Real Unread Counts — DONE

### TASK 49 — Mention System (@username) `DONE`
#### SPEC
- **Backend:** When a message is sent, parse the content for `@username`. Extract the mentioned users and send a specific priority push/STOMP notification to them (`MENTIONED_YOU`).
- **Frontend:** In `ChatScreen`, detect typing `@` and show a floating list of group members to auto-complete. Render `@username` in the message bubble with a distinct color (e.g., Cyan) and make it clickable to open their Profile.
- **Test:** Mention a user in a group chat, verify they get a specific mention notification and the text is highlighted.

### TASK 50 — Message Search `DONE`
#### SPEC
- **Backend:** Create `GET /api/messages/search?q={query}&conversationId={id}`. Add a Text Index to the `content` field in MongoDB for efficient searching.
- **Frontend:** Add a search icon in the `ChatScreen` AppBar. Open a search bar, call the API, and display results in a list. Clicking a result jumps to that message.
- **Test:** Search for a specific word, get the result, and navigate to the message location.

### TASK 51 — Real Unread Count per Conversation `DONE`
#### SPEC
- **Backend:** Add logic in `listConversations` to compute and return `unreadCount` for each conversation. (Compare the latest message timestamp/ID against the user's `readReceipt` mark).
- **Frontend:** Read the `unreadCount` from the API response and display a red badge (e.g., "3") on the conversation list item instead of just a generic dot.
- **Test:** Receive 5 messages while outside the chat. The list screen shows a red badge "5".

---

## 🟢 SPRINT 14 — Conversation Channels & Advanced Actions — DONE

### TASK 52 — Public Channels Discovery `DONE`
#### SPEC
- **Backend:** Add `isPublic` (boolean) to Conversation schema. Create `GET /api/conversations/public` to list public channels, and `POST /api/conversations/{id}/join` to join them.
- **Frontend:** Add an "Explore" tab to discover public channels. Users can click and join.
- **Test:** Create a public channel, another user searches and joins it successfully.

### TASK 53 — Pin & Forward Messages `DONE`
#### SPEC
- **Backend:** Add `pinnedMessages` array to Conversation schema. Endpoints: `POST /messages/{id}/pin`, `POST /messages/{id}/forward`.
- **Frontend:** Long-press -> Pin. Render a pinned message bar at the top of the ChatScreen. Long-press -> Forward -> show conversation picker.
- **Test:** Pin a message -> shows at the top for everyone.

### TASK 54 — Rich Text / Markdown Rendering `DONE`
#### SPEC
- **Frontend:** Replace standard `Text` widget in `MessageBubble` with `flutter_markdown` or similar to support bold, italic, code blocks, and lists.
- **Test:** Send `**Bold** and *Italic*` -> renders correctly.

---

## 🟢 SPRINT 15 — Infrastructure & Reliability — DONE

### TASK 55 — Offline Message Catch-up `DONE`
#### SPEC
- **Frontend/Backend:** When STOMP reconnects, fetch all messages missed during the offline period (using the timestamp of the last cached message). Sync the local state.
- **Test:** Go offline -> receive messages -> go online -> messages sync automatically without refreshing the whole page.

### TASK 56 — Rate Limiting (Throttle) `DONE`
#### SPEC
- **Backend:** Implement Bucket4j or Redis-based rate limiting to prevent spamming endpoints (e.g., max 10 messages / 5 seconds per user). Return HTTP 429 Too Many Requests if exceeded.
- **Test:** Spam send button -> server blocks and returns 429.

---

## 🟢 SPRINT 16 — Shared Media Gallery & Reaction Details — DONE

### TASK 57 — Shared Media & Links Gallery `DONE`
#### SPEC
- **Backend:**
  - `MessageRepository`: Add `findByConversationIdAndTypeInOrderByCreatedAtDesc` (for image/video and file). Add custom query `findLinks` with regex `https?://` for text messages.
  - `MessageService`: Add `getSharedAttachments(userId, conversationId, type, pageable)` with participant checks.
  - `ConversationController`: Expose `GET /api/conversations/{id}/attachments?type=media|file|link`.
- **Frontend:**
  - `ChatRepository`: Add `getSharedAttachments`.
  - Create `ExploreMediaScreen` with 3 tabs (Media, Files, Links).
  - Add "Shared Media & Files" navigation button in `GroupInfoScreen` and `UserProfileScreen`.
- **Test:** Send media, document, and link -> enter Profile/GroupInfo -> Shared Media -> see all attachments categorized correctly.

### TASK 58 — Reactions Detail Modal `DONE`
#### SPEC
- **Frontend:**
  - Create `ReactionsDetailModal` to show users resolved via `userProfileProvider` grouped by emoji tab.
  - Add tap listener to message bubble reaction chips to trigger the modal.
- **Test:** Tap on reaction chips below a message, verify the modal lists who reacted with which emoji.

---

## 🟢 SPRINT 17 — Profile & UX Enhancements — DONE

### TASK 59 — Date of Birth & Cover Photo Customization `DONE`
#### SPEC
- **Database / Backend:**
  - Add `dateOfBirth?: Date` to `User` schema. Expose updates in `PATCH /api/users/me`.
- **Frontend:**
  - Support `dateOfBirth` property on `UserModel`.
  - Display Date of Birth (formatted) on `UserProfileScreen`.
  - Redesign `EditProfileScreen` to display cover photo stack with camera buttons and DOB Date Picker list tile.
- **Test:** Edit and save DOB and cover photo, verify update takes effect and profile shows them.

### TASK 60 — User Password Change `DONE`
#### SPEC
- **Backend:**
  - Expose `POST /api/users/me/change-password` endpoint to verify current password and hash/update to new password.
- **Frontend:**
  - Implement `ChangePasswordDialog` to prompt for current, new, and confirm passwords.
  - Expose "Change Password" in `SettingsScreen`.
- **Test:** Verify change password validates matches and updates correctly.

### TASK 61 — Double-Tap Message Reactions `DONE`
#### SPEC
- **Frontend:**
  - Bind double-tap gesture on `MessageBubble` to quickly trigger/toggle a ❤️ reaction.
- **Test:** Double-tap a message bubble, verify a ❤️ reaction is instantly added.

---

## 🟢 SPRINT 19 — UX Fixes & Delete For Me — DONE

### TASK 68 — Edit Profile UX Routing `DONE`
#### SPEC
- **Frontend:**
  - The DOB and Cover photo features were added to `edit_profile_screen.dart`, but the user cannot reach it. 
  - Remove the inline `_nameController` and "Personal Info" text field in `SettingsScreen`.
  - Replace them with a new `ListTile` (Icon: person, Title: "Edit Profile") that calls `context.push('/edit-profile')`.
- **Test:** Open Settings, tap "Edit Profile", verify navigation to the full Edit Profile screen where DOB and Cover Photo exist.

### TASK 69 — Delete Message For Me `DONE`
#### SPEC
- **Backend:**
  - Add `deletedBy: List<String>` to `Message` model (if using Mongo, array of strings).
  - Implement `DELETE /api/messages/{id}/for-me` in `MessageController`.
  - Update `MessageService` to append the `userId` to `deletedBy`.
  - Exclude messages from `getMessages` and `searchMessages` if the `deletedBy` contains `userId`.
- **Frontend:**
  - Add `deleteForMe(messageId)` to `ChatRepository` and `ChatNotifier` (optimistic UI update).
  - Wire up the "Delete for me" option in `FloatingReactionSheet` to call this API.
- **Test:** Send a message, open floating reaction sheet, select "Delete for me". Verify the message disappears for you but remains for the other person.

---

## 🟡 SPRINT 20 — Messenger UX Overhaul & Web Layout

### TASK 70 — In-App Notifications & Localization Fix `PENDING`
#### SPEC
- **Frontend:**
  - Replace `showInAppNotification` bottom `SnackBar` in `global_messenger.dart` with a custom top-sliding `OverlayEntry` (or approved package). Ensure it auto-dismisses and doesn't block clicks.
  - In `chat_provider.dart`, resolve the actual sender name instead of `senderId`.
  - Replace hardcoded Vietnamese strings with `newNotificationTitle` and `newNotificationBody` from l10n.
- **Test:** Receive a message, verify a top-down notification appears with the correct name and localized text.

### TASK 71 — Archived Chats Screen `PENDING`
#### SPEC
- **Frontend:**
  - Create `ArchivedChatsScreen` to display conversations where `isArchived == true`.
  - Add an entry point to this screen from the `ConversationListScreen` (e.g., in the AppBar or a fixed top tile).
- **Test:** Archive a chat, go to Archived Chats, unarchive it, verify it moves back.

### TASK 72 — Master-Detail Web Layout & Settings Separation `PENDING`
#### SPEC
- **Frontend:**
  - Create `ResponsiveHomeLayout` (`LayoutBuilder`). If `maxWidth < 800`, return `ConversationListScreen` (standard push routing). If `maxWidth >= 800`, return a `Row` (Split View: left `ConversationListScreen`, right `ChatScreen`).
  - Introduce `selectedConversationIdProvider` for Web to update the right pane without pushing a route.
  - Refactor `SettingsScreen`: On Mobile, it remains a separate screen. On Web, it opens as a centralized `Dialog`. Add a settings button to the bottom-left of the Web `ConversationListScreen`.
- **Test:** Resize web window. Verify standard mobile routing below 800px and split-view routing above 800px. Verify Web settings open in a dialog.

---

## 🔴 SPRINT 21 — Comprehensive QA & E2E Bug Fixes

### TASK 73 — Critical Navigation & Theme Fixes `DONE`
#### SPEC
- **Frontend:**
  - **Split Layout Navigation Bug:** Fix `app_router.dart` so sub-screens (Group Info, Search) push correctly without breaking Web Split Layout (consider using `rootNavigator: true` for `context.push` or revising `ResponsiveHomeLayout`).
  - **Light Mode Black Backgrounds:** Replace hardcoded `Colors.black` and `Colors.grey.shade900` in Emoji Picker, Attachment Picker, and input fields with `Theme.of(context).scaffoldBackgroundColor` or `Theme.of(context).cardColor`.
- **Test:** Turn on Light Mode, ensure no black blocks. Open Group Info on Web and hit back — verify split layout remains intact.

### TASK 74 — Chat UX & Scrolling Fixes `DONE`
#### SPEC
- **Frontend:**
  - **Sent Messages Cut Off:** Add `margin: const EdgeInsets.only(right: 16)` to right-aligned bubbles.
  - **Auto-scroll:** In `ChatScreen`, automatically scroll to the bottom (`_scrollController.animateTo(0.0)`) when the user sends a new message.
  - **Search Jump-to-Message:** Ensure clicking a search result actually scrolls the chat to that specific message.
- **Test:** Send a message, verify it auto-scrolls down and doesn't get clipped on the right. Search a message and click it to jump.

### TASK 75 — High/Medium UI Polish `DONE`
#### SPEC
- **Frontend:**
  - **Settings Modal:** Wrap Web `SettingsScreen` in `SingleChildScrollView`. Close Settings modal before pushing Edit Profile.
  - **Top Nav Icons:** Fix `chat_screen_app_bar` / `conversation_list_screen`: Person+ goes to Add Friend, People goes to Contacts.
  - **Group Chat Avatar:** Show sender Avatar and Name above received messages in Group Chats.
  - **Change Password:** Add `Icons.visibility` toggle for password fields.
  - **Call Screen:** Push `/call` with `rootNavigator: true` to make it fullscreen.
- **Test:** Open Web Settings -> scroll to Log Out. Verify Group chat shows names. Toggle password visibility.

---

## 🟢 REFACTORING LOG

### [2026-06-01] Clean Code Audit — Flutter Client File Size Compliance

**Rules applied:** Flutter UI ≤ 400 lines, Backend ≤ 500 lines (`.claude/rules/clean-code.md`).

**Backend status:** All files within limits (max `MessageService.java` = 388 lines). No action needed.

**Flutter refactoring results:**

| File | Before | After | Status |
|------|--------|-------|--------|
| `chat/ui/chat_screen.dart` | 1525 | 569 | ⚠️ Reduced 63%; residual state logic unavoidable |
| `chat/ui/widgets/message_bubble.dart` | 887 | 315 | ✅ |
| `settings/ui/settings_screen.dart` | 664 | 339 | ✅ |
| `chat/ui/conversation_list_screen.dart` | 508 | 348 | ✅ |
| `chat/domain/chat_provider.dart` | 652 | 652 | ⚠️ Domain provider — codegen prevents split |
| `chat/domain/chat_state.dart` | 470 | 470 | ℹ️ Pure data models, cohesive — left intact |

**New files created (15 total):**

*From `chat_screen.dart`:*
- `widgets/reply_composer_bar.dart` — `ReplyComposerBar`
- `widgets/edit_composer_bar.dart` — `EditComposerBar`
- `widgets/chat_typing_indicator.dart` — `ChatTypingIndicator`
- `widgets/chat_input_bar.dart` — `ChatInputBar`
- `widgets/blocked_composer_notice.dart` — `BlockedComposerNotice`
- `widgets/stranger_request_banner.dart` — `StrangerRequestBanner`
- `widgets/mention_list.dart` — `MentionList`
- `widgets/search_overlay.dart` — `SearchOverlay`
- `widgets/chat_app_bar.dart` — `ChatScreenAppBar` (ConsumerWidget + PreferredSizeWidget)
- `ui/chat_screen_helpers.dart` — `pickAndSendMedia`, `pickAndSendDocument`, `showAutoDeletePicker`, `showConfirmDialog`

*From `message_bubble.dart`:*
- `widgets/image_content.dart` — `ImageContent`, `VideoContent`, media URL helpers
- `widgets/text_content.dart` — `TextContent` (mention highlighting + URL detection)
- `widgets/link_preview_card.dart` — `LinkPreviewCard`
- `widgets/file_content.dart` — `FileContent`, `formatBytes`, `fileIcon`
- `widgets/message_bubble_parts.dart` — `SenderName`, `ReplyQuote`, `ReactionChips`, `SystemMessage`

*From `settings_screen.dart`:*
- `settings/ui/widgets/settings_dialogs.dart` — `ThemeDialogOption`, `LanguageDialogOption`, `SettingsAvatarSection`, `SettingsLogoutCard`, dialog functions

*From `conversation_list_screen.dart`:*
- `widgets/conversation_tile.dart` — `ConversationTile`, `OfflineBanner`

**Verification:** `flutter analyze` → No issues found. `flutter test` → All tests passed.

---

## 🧪 QA LOG
- [2026-06-03] **SPRINT 24 (TASKS 89–90) → ✅ DONE (full vertical slices).**
  - **TASK 89 — Voice Messages:**
    - FE: Added `record: ^5.1.2`, `audioplayers: ^6.1.0`, `path_provider: ^2.1.4` to `pubspec.yaml`.
      `MessageModel`: added `isVoice` getter (`type == 'voice'`).
      `ChatInputBar`: new `onVoiceSend` callback; when text is empty shows mic icon button
      (`Icons.mic_none_outlined`); tap starts recording via `AudioRecorder` (permission-guarded, temp `.m4a` path).
      Active recording shows red mic + elapsed timer + cancel/send buttons in place of the normal row.
      `_ChatScreenState._onVoiceSend`: reads recorded file bytes (mobile) / blob URL (web), uploads via
      `chatRepositoryProvider.uploadDocument`, sends `type: 'voice'` message with the returned URL.
      New `VoiceMessageBubble` widget (`voice_message_bubble.dart`, 148 lines): `AudioPlayer` (audioplayers) plays
      from `UrlSource(url)`, tracks `onPlayerStateChanged`/`onPositionChanged`/`onDurationChanged` streams;
      play/pause button + `Slider` seek bar + duration/position label; styled for sent (white) and received (cyan) variants.
      `MessageBubble`: added `isVoice` case rendering `VoiceMessageBubble`.
      i18n: `voiceMicTooltip`, `recording` added to all 7 ARB files.
  - **TASK 90 — Stickers Panel:**
    - FE: New `EmojiStickerPanel` widget (`emoji_sticker_panel.dart`, 136 lines): `TabController` with 2 tabs —
      "Emoji" tab shows existing `EmojiPicker`; "Stickers" tab shows `_StickerGrid` (16 emoji stickers in 4-column
      `GridView`). `kStickerList = ['😊','😂','🥰','😎','🤔','😭','🎉','❤️','🔥','👍','🙏','💯','🥲','😴','😡','🤗']`.
      `ChatScreen._onStickerSelected(sticker)` sends `type: 'sticker'` message with the emoji char as content,
      then closes the panel.
      `MessageModel`: added `isSticker` getter (`type == 'sticker'`).
      `MessageBubble`: sticker case skips bubble decoration (`decoration: null`, zero padding) and renders a
      transparent `Text(content, fontSize: 100)` — no background, no border, no gradient, matching Telegram/Messenger style.
      `ChatScreen` emoji panel replaced with `EmojiStickerPanel`.
      i18n: `stickerLabel`, `emojiTab` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **Tests:**
    - `flutter analyze` → **1 pre-existing info** in `chat_provider.dart:283` (unrelated); **no new issues**.
    - `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — `ChatInputBar` 314 lines, `VoiceMessageBubble` 148, `EmojiStickerPanel` 136,
    `MessageBubble` 236; `chat_screen.dart` 723 lines (pre-established exception for state logic).
  - **Files for Gemini QC:** FE — `pubspec.yaml`, `domain/chat_state.dart`,
    `ui/widgets/chat_input_bar.dart`, `ui/widgets/voice_message_bubble.dart`,
    `ui/widgets/emoji_sticker_panel.dart`, `ui/widgets/message_bubble.dart`,
    `ui/chat_screen.dart`, `l10n/app_*.arb`.

- [2026-06-02] **SPRINT 19 (TASKS 68–69) → ✅ DONE.**
  - **TASK 68 — Edit Profile UX Routing:**
    - FE: Rewrote `settings/ui/settings_screen.dart` — converted `ConsumerStatefulWidget` →
      `ConsumerWidget` (no local state left). Removed the inline `_nameController`, `_save()`,
      `_isLoading`, `initState`/`dispose`, and the AppBar "Save" action. Dropped the "Personal Info"
      `PonCard` + `PonTextField`.
      Added an "Edit Profile" `ListTile` (person icon, `l10n.editProfile`) that calls
      `context.push('/edit-profile')` — the full Edit Profile screen with DOB + Cover Photo is now reachable.
      Extracted a private `_settingsCard(...)` builder so the Edit Profile / Appearance / Language /
      Change Password tiles share one consistent card style (kept the file well under the 400-line limit).
      Now also shows `displayName` (above email) under the avatar so the name still surfaces in Settings.
      No new i18n key needed — `editProfile` already existed in all 7 ARB files.
  - **TASK 69 — Delete Message For Me:** verified **already implemented** end-to-end, left intact.
    - BE: `Message.deletedFor: List<String>` (`@Builder.Default`); `MessageService.deleteForMe(userId, messageId)`
      appends the userId idempotently; `MessageController POST /api/messages/{id}/delete-for-me`.
      `getMessages`, `getMessagesSince`, and `searchMessages` all filter out messages whose `deletedFor`
      contains the caller. (Field is `deletedFor` / route `…/delete-for-me` — functionally equivalent to the
      spec's `deletedBy` / `…/for-me`; FE and BE agree, so no rename needed.)
    - FE: `ChatRepository.deleteMessageForMe`, `ChatNotifier.deleteForMe` (optimistic local removal),
      and the "Delete for me" action in `FloatingReactionSheet` are all wired.
  - **Tests:** `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
    Backend untouched (Task 69 pre-existed) — no `mvn` run needed.
  - **Files for Gemini QC:** FE — `settings/ui/settings_screen.dart`.
- [2026-06-01] **TASK 45 — Edit Message → ✅ DONE (full vertical slice).**
  Token budget was tight, so only TASK 45 was cherry-picked (per shutdown instructions);
  TASKS 46–48 remain PENDING.
  - **BE (chat-service):**
    - `Message` model: added `editedAt` (Instant).
    - `MessageResponse` DTO: added `editedAt` field (+ kept backward-compat ctor).
    - `MessageService.editMessage(userId, messageId, newContent)`: sender-only guard,
      rejects editing recalled messages, rejects blank content, stamps `editedAt`.
    - `MessageController`: new `PUT /api/messages/{id}` (body `EditMessageRequest{content}`),
      broadcasts STOMP `MESSAGE_UPDATED` (messageId, content, editedAt) to the conversation topic.
  - **FE (Flutter client):**
    - `MessageModel`: added `editedAt` + `isEdited` getter; parsed in `fromJson`, threaded through `copyWith`.
    - `chat_repository.editMessage()` → PUT call.
    - `stomp_service`: new `editedMessages` stream + `MESSAGE_UPDATED` case → `MessageUpdateEvent`.
    - `ChatNotifier`: `_onEdit` realtime handler, optimistic `editMessage()`, `startEditing/cancelEditing`;
      `ChatState.editingMessage` (mutually exclusive with reply).
    - `MessageBubble`: long-press → "Edit" action (own text messages, not media/recalled);
      shows `(edited)` tag next to the timestamp.
    - `ChatScreen`: `_EditComposerBar` pre-fills composer via `ref.listen`; send button commits the edit.
    - i18n: `actionEdit` + `messageEdited` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 40/40** (MessageServiceTest 16, incl. 4 new edit tests:
      sender-edits-ok, non-sender-throws, recalled-throws, blank-throws).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** `model/Message.java`, `dto/MessageResponse.java`, `dto/EditMessageRequest.java`,
    `service/MessageService.java`, `controller/MessageController.java`, `service/MessageServiceTest.java`,
    `chat_state.dart`, `chat_repository.dart`, `stomp_service.dart`, `chat_provider.dart`,
    `ui/widgets/message_bubble.dart`, `ui/chat_screen.dart`, `l10n/app_*.arb`.
- [2026-06-01] **TASKS 46–48 → ✅ DONE (full vertical slices).**
  - **TASK 46 — General File Upload (PDF/DOC/ZIP):**
    - BE `UploadController`: broadened validation to accept `image/ video/ audio/ text/ application/`
      (was image+video only); `resolveContentType` now maps doc/archive extensions
      (pdf, doc(x), xls(x), ppt(x), txt, csv, json, zip, rar, 7z) and trusts non-generic
      client content types. Upload response now also returns `filename` + `size` + `contentType`.
    - FE: added `file_picker: ^8.1.2`. `chat_repository.uploadDocument(bytes, name)` → returns
      `(url, name, size)`. `MessageModel`: `isFile` + `fileUrl/fileName/fileSize` (decode JSON content).
      `ChatScreen`: new "File" option in the attach sheet → `_pickAndSendDocument` (picks w/ `withData`,
      uploads, sends `type:'file'` whose content is JSON `{url,name,size}`).
      `MessageBubble`: new `_FileContent` card (type icon by extension, filename, human size, download icon);
      copy action copies the url; edit hidden for file messages. i18n: `attachFile` added to all 7 ARB.
  - **TASK 47 — Cursor-based Pagination:**
    - BE `MessageRepository`: added `findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc`.
      `MessageService.getMessages(userId, conversationId, beforeId, size)` — resolves cursor via the
      beforeId's `createdAt`, over-fetches `size+1` to set `hasNext` (encoded in synthetic `totalElements`).
      `ConversationController` messages endpoint now takes `?before=&size=` (replaces `page`).
    - FE `chat_repository.getMessages(conversationId, {before, size})` reads `hasNext`;
      `PagedResult.hasNext`. `ChatNotifier.loadMore` passes the oldest non-pending message id as the cursor
      and de-dupes by id (stable scroll, no jump/dupe when new messages arrive while scrolling up).
  - **TASK 48 — Link Preview (OG Unfurl):**
    - BE: `GET /api/utils/link-preview?url=` (`UtilsController` + `LinkPreviewService` + `LinkPreviewResponse`).
      Dependency-free JDK `HttpClient` unfurl: og:/twitter: meta + `<title>` regex, 6s timeout, 512KB cap,
      http(s)-only guard, relative-image resolve, basic HTML-entity decode. Degrades to a minimal card on error.
    - FE: `chat_repository.fetchLinkPreview` + `linkPreviewProvider` (autoDispose family, per-url cache).
      `MessageBubble._TextContent` detects the first URL and renders `_LinkPreview` (image + siteName + title +
      description, tap to open). Renders nothing while loading / on error / when no metadata.
  - **Tests:**
    - `mvn clean compile` → SUCCESS; `mvn test` → **BUILD SUCCESS, 41/41**
      (MessageServiceTest 17, incl. new cursor test `getMessages_WithCursor_ShouldQueryOlderMessages`).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** BE — `controller/UploadController.java`, `controller/ConversationController.java`,
    `controller/UtilsController.java`, `service/MessageService.java`, `service/LinkPreviewService.java`,
    `repository/MessageRepository.java`, `dto/LinkPreviewResponse.java`, `service/MessageServiceTest.java`;
    FE — `pubspec.yaml`, `data/chat_repository.dart`, `domain/chat_state.dart`, `domain/chat_provider.dart`,
    `ui/chat_screen.dart`, `ui/widgets/message_bubble.dart`, `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 14 (TASKS 52–54) → ✅ DONE (full vertical slices).**
  - **TASK 52 — Public Channels Discovery:**
    - BE: Added `publicChannel` (boolean, `@Builder.Default false`) to `Conversation` model.
      `ConversationRepository`: `findPublicGroups` + `findPublicGroupsByName` queries.
      `ConversationService`: `listPublicChannels(query, pageable)` + `joinChannel(userId, convId)` (idempotent join).
      `ConversationController`: `GET /api/conversations/public?q=&page=&size=` + `POST /api/conversations/{id}/join`.
      `ConversationResponse`: added `isPublic` (boolean) + `List<PinnedMessageDto> pinnedMessages` fields
      (plus backward-compatible ctor without new fields).
    - FE: Added `isPublic` + `pinnedMessages: List<PinnedMessageModel>` to `ConversationModel`.
      `ChatRepository`: `listPublicChannels(query)` + `joinChannel(convId)`.
      New `ExploreScreen` with debounced search + channel tiles. `/explore` route added to router.
      Explore icon in `ConversationListScreen` AppBar.
  - **TASK 53 — Pin & Forward Messages:**
    - BE: Added `pinnedMessages: List<String>` (message ids, max 5, newest first) to `Conversation` model.
      `MessageService`: `pinMessage` + `unpinMessage` (both return `PinResult{conversationId, pinnedMessages}`)
      + `forwardMessage` (creates copy in target conversation). Group pin/unpin requires admin.
      `MessageController`: `POST /api/messages/{id}/pin` + `DELETE /api/messages/{id}/pin`
      + `POST /api/messages/{id}/forward`. All broadcast `PINNED_MESSAGE` STOMP event.
      New DTOs: `ForwardMessageRequest`, `PinResult`.
    - FE: `PinnedMessageEvent` added to `chat_state.dart`.
      `StompService`: `_pinCtrl` stream + `PINNED_MESSAGE` case in `_doSubscribeConversation`.
      `ChatState.pinnedMessages` (List<PinnedMessageModel>) populated from conversation on build.
      `ChatNotifier`: `pinMessage`, `unpinMessage`, `forwardMessage` actions + `_onPinnedMessage` handler.
      `ChatRepository`: `pinMessage`, `unpinMessage`, `forwardMessage` methods.
      New `PinnedMessageBar` widget — shows first pinned message at top of ChatScreen with jump + dismiss.
      New `ForwardDialog` widget — conversation picker for forwarding.
      `MessageBubble` long-press menu: "Pin" + "Forward" actions.
      `ChatScreen`: `PinnedMessageBar` shown when `chatState.pinnedMessages.isNotEmpty`.
  - **TASK 54 — Rich Text / Markdown Rendering:**
    - FE: Added `flutter_markdown: ^0.7.7` to `pubspec.yaml`.
      `TextContent` widget: detects markdown syntax via regex; uses `MarkdownBody` for messages
      without mentions (supports **bold**, *italic*, `code`, code blocks, lists, blockquotes, links).
      Falls back to existing `Text.rich` approach for messages with @mentions.
      Custom `MarkdownStyleSheet` matches the app's neon dark theme.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 51/51** (MessageServiceTest 27 incl. 6 new: pin-ok,
      pin-not-participant, pin-recalled, unpin, forward-ok, forward-recalled).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — BE max 469 lines (MessageService), FE new files max 184 lines.
  - **Files for Gemini QC:** BE — `model/Conversation.java`, `dto/ConversationResponse.java`,
    `dto/ForwardMessageRequest.java`, `dto/PinResult.java`, `repository/ConversationRepository.java`,
    `service/ConversationService.java`, `service/MessageService.java`,
    `controller/ConversationController.java`, `controller/MessageController.java`,
    `service/MessageServiceTest.java`; FE — `domain/chat_state.dart`, `data/chat_repository.dart`,
    `data/stomp_service.dart`, `domain/chat_provider.dart`, `ui/chat_screen.dart`,
    `ui/explore_screen.dart`, `ui/widgets/pinned_message_bar.dart`,
    `ui/widgets/forward_dialog.dart`, `ui/widgets/message_bubble.dart`,
    `ui/widgets/text_content.dart`, `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 15 (TASKS 55–56) → ✅ DONE (full vertical slices).**
  - **TASK 55 — Offline Message Catch-up:**
    - BE: `MessageRepository` — added `findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc`
      (catch-up query, oldest-first, pageable, capped at 50).
      `MessageService.getMessagesSince(userId, conversationId, afterTimestamp)` — participant guard,
      clear-cutoff + deleted-for-me filters, returns list sorted oldest-first.
      `ConversationController GET /{id}/messages` — added optional `?after=<ISO>` param:
      when present delegates to `getMessagesSince` and wraps in `PageResponse`.
    - FE: `StompService` — `_everConnected` flag + `_reconnectCtrl` broadcast stream;
      `_onConnect` emits to `reconnects` only on second-and-later connects (not initial).
      `ChatRepository.getMessagesSince(conversationId, afterTimestamp)` → hits `?after=` endpoint.
      `ChatNotifier` — `_reconnectSub` listens to `stomp.reconnects`; `_catchupMessages()` finds
      newest non-pending message, fetches fresh messages, dedupes by id, prepends in
      newest-first order, marks them as read. Subscription cancelled on dispose.
  - **TASK 56 — Rate Limiting:**
    - BE: New `RateLimitExceededException` (RuntimeException). New `RateLimiterService` —
      Redis fixed-window: INCR key `rate:msg:<userId>`, auto-expire 5s, throws on count > 10.
      `GlobalExceptionHandler` — 429 handler with `Retry-After: 5` header.
      `MessageController.sendMessage()` (REST) — calls `rateLimiterService.checkMessageRate()`,
      propagates as HTTP 429 via GlobalExceptionHandler.
      `ChatController.send()` (STOMP) — catches `RateLimitExceededException`, sends
      `{type:RATE_LIMITED}` to `/user/queue/notifications` instead (STOMP has no HTTP status).
    - FE: `ConversationsNotifier._onNotification()` — handles `RATE_LIMITED` type by calling
      `showErrorSnackBar` with `ctx.l10n.rateLimitError` (l10n key added to all 7 ARBs).
      `ChatNotifier.sendMessage()` REST fallback — catches `DioException` 429, shows snackbar.
      i18n: `rateLimitError` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 53/53** (MessageServiceTest 29 incl. 2 new:
      `getMessagesSince_ShouldReturnNewerMessages`, `getMessagesSince_WhenNotParticipant_ShouldThrow`;
      `ChatControllerTest` updated with `@Mock RateLimiterService`).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** BE max 498 lines (MessageService — within 500 limit); FE domain provider
    780 lines (pre-noted codegen exception); all new files and other modified files within limits.
  - **Files for Gemini QC:** BE — `exception/RateLimitExceededException.java`,
    `service/RateLimiterService.java`, `exception/GlobalExceptionHandler.java`,
    `repository/MessageRepository.java`, `service/MessageService.java`,
    `controller/ConversationController.java`, `controller/ChatController.java`,
    `controller/MessageController.java`, `service/MessageServiceTest.java`,
    `controller/ChatControllerTest.java`;
    FE — `data/stomp_service.dart`, `data/chat_repository.dart`, `domain/chat_provider.dart`,
    `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 17 (TASKS 59–61) → ✅ DONE (full vertical slices).**
  - **TASK 59 — Date of Birth & Cover Photo Customization:**
    - DB/BE: Added `dateOfBirth: Date` to the `User` schema in `@platform/database`. Updated `UsersService` to parse `dateOfBirth` and update the profile database entry. Exposed in `Patch /api/users/me`.
    - FE: Added `dateOfBirth` property to `UserModel`. Displayed formatted birthday row on `UserProfileScreen`. Redesigned `EditProfileScreen` with overlapping cover photo header and avatar stack (Zalo/Facebook style), including a native `showDatePicker` DOB picker.
  - **TASK 60 — User Password Change:**
    - BE: Added `POST /api/users/me/change-password` endpoint. Verified current password using `bcrypt` and updated to hashed new password.
    - FE: Created modular `ChangePasswordDialog` widget in `change_password_dialog.dart`. Added a "Change Password" tile in `SettingsScreen`.
  - **TASK 61 — Double-Tap Reactions:**
    - FE: Bound `onDoubleTap` to message bubbles in `MessageBubble` to toggle a ❤️ reaction.
  - **Tests:**
    - `pnpm --filter @platform/auth-service test` $\rightarrow$ **PASS (6/6)**.
    - `flutter analyze` $\rightarrow$ **No issues found**; `flutter test` $\rightarrow$ **All tests passed**.
  - **File sizes:** All within limits.
  - **Files for Gemini QC:** BE — `user.schema.ts`, `users.service.ts`, `users.controller.ts`; FE — `auth_state.dart`, `auth_repository.dart`, `auth_provider.dart`, `user_profile_screen.dart`, `edit_profile_screen.dart`, `change_password_dialog.dart`, `settings_screen.dart`, `message_bubble.dart`, `app_*.arb`.
- [2026-06-02] **SPRINT 16 (TASKS 57–58) → ✅ DONE (full vertical slices).**
  - **TASK 57 — Shared Media & Links Gallery:**
    - BE: `MessageRepository` — added `findByConversationIdAndTypeInOrderByCreatedAtDesc` (media/file types)
      and `findLinksByConversationId` (text messages with `https?://` regex, non-recalled).
      New `AttachmentService` (66 lines) handles gallery logic to keep `MessageService` within 500-line limit;
      calls package-private `MessageService.toResponse()` from same package.
      `ConversationController`: new `GET /api/conversations/{id}/attachments?type=media|file|link` endpoint
      (with participant validation delegated to `AttachmentService`).
    - FE: `ChatRepository.getSharedAttachments(conversationId, type)` → paginated REST call.
      New `ExploreMediaScreen` (290 lines) — 3-tab layout (Media grid, Files list, Links list);
      Media tab: 3-column grid of `CachedNetworkImage` thumbnails.
      Files tab: reuses existing `FileContent` widget in a `ListView`.
      Links tab: fetches OG metadata via existing `linkPreviewProvider`, tap-to-open via `url_launcher`.
      `GroupInfoScreen`: added "Shared Media & Files" `ListTile` → `/shared-media/:id`.
      `UserProfileScreen`: accepts optional `conversationId`; shows media tile for non-self profiles.
      New route `/shared-media/:conversationId` in `app_router.dart`.
    - i18n: `sharedMediaTitle`, `tabMedia`, `tabFiles`, `tabLinks`, `noMediaFound`, `noFilesFound`,
      `noLinksFound`, `reactionsDetail` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **TASK 58 — Reactions Detail Modal:**
    - FE: New `ReactionsDetailModal` bottom sheet (146 lines, `DraggableScrollableSheet`).
      Groups reactors by emoji into tabs (scrollable when > 4 emojis); each tab lists users
      resolved via `userProfileProvider` (avatar + displayName).
      `ReactionChips` in `message_bubble_parts.dart`: wrapped each chip in `GestureDetector`
      that calls `showReactionsDetailModal(context, message)` on tap.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 53/53** (no new backend tests needed — AttachmentService
      delegates to existing repository layer already covered by Spring Data contracts).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — BE max 197 lines (ConversationController), new AttachmentService 66 lines;
    FE new files max 290 lines (ExploreMediaScreen), modified files max 348 lines (UserProfileScreen).
  - **Files for Gemini QC:** BE — `repository/MessageRepository.java`, `service/AttachmentService.java`,
    `controller/ConversationController.java`; FE — `data/chat_repository.dart`,
    `ui/explore_media_screen.dart`, `ui/widgets/reactions_detail_modal.dart`,
    `ui/widgets/message_bubble_parts.dart`, `ui/group_info_screen.dart`,
    `ui/user_profile_screen.dart`, `core/router/app_router.dart`, `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 18 (TASKS 62–67) → ✅ DONE (full vertical slices).**
  - **TASK 62 — Mute / Unmute Conversations:**
    - BE: Added `mutedUsers: List<String>` to `Conversation` model (`@Builder.Default`).
      `ConversationService.muteConversation / unmuteConversation` — idempotent toggle, participant-guarded.
      `ConversationController`: `POST /api/conversations/{id}/mute` + `POST /api/conversations/{id}/unmute`;
      both broadcast `CONVERSATION_UPDATED` STOMP event.
      `ConversationResponse`: added `isMuted` (boolean) field; computed from caller's userId.
      `ConversationService.isMuted(conversationId, userId)` exposed for `ChatController` notification gating.
    - FE: `ConversationModel.isMuted` parsed from JSON. `ChatRepository.muteConversation / unmuteConversation`.
      `ConversationsNotifier`: `mute/unmute` actions + optimistic state update.
      `ChatScreenAppBar` overflow menu: "Mute" / "Unmute" toggle. Mute icon overlay on `ConversationTile` avatar.
  - **TASK 63 — Archive / Unarchive Conversations:**
    - BE: Added `archivedBy: List<String>` to `Conversation` model (`@Builder.Default`).
      `ConversationService.archiveConversation / unarchiveConversation` — idempotent toggle.
      `ConversationController`: `POST /api/conversations/{id}/archive` + `POST /api/conversations/{id}/unarchive`.
      `listConversations` filters out conversations where the caller is in `archivedBy` (archived chats hidden from main list).
      `ConversationResponse`: added `isArchived` (boolean) field.
    - FE: `ConversationModel.isArchived` parsed. `ChatRepository.archiveConversation / unarchiveConversation`.
      Swipe-to-archive gesture on `ConversationTile`. Archived conversations hidden from default list view.
  - **TASK 64 — Mark Conversation Read / Unread (REST):**
    - BE: `ConversationService.markConversationUnread` — removes the caller from `readBy` on the last message,
      incrementing the unread badge by 1.
      `ConversationService.markConversationRead` — bulk-marks all unread messages as read for the caller.
      `ConversationController`: `POST /api/conversations/{id}/unread` + `POST /api/conversations/{id}/read`.
    - FE: `ChatRepository.markConversationUnread / markConversationRead`.
      Long-press on `ConversationTile` → context menu with "Mark as unread" / "Mark as read".
  - **TASK 65 — Floating Glassmorphic Reaction Sheet:**
    - FE: New `FloatingReactionSheet` (`floating_reaction_sheet.dart`) — `BackdropFilter` blur (sigmaX/Y 12),
      frosted-glass container (`AppTheme.darkSurface` at 75% opacity + 8% white border), pull indicator.
      Top row: 6 quick-reaction emojis (`👍 ❤️ 😂 😮 😢 😡`) in a pill container; selected emoji gets
      a highlighted ring. Action list: Reply, Copy, Edit (own non-media), Recall (own), Pin, Forward, Delete-for-me.
      `MessageBubble` long-press now calls `FloatingReactionSheet.show` instead of a plain `PopupMenuButton`.
      i18n: new keys added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **TASK 66 — Conversation Avatar & List UX Improvements:**
    - FE: `ConversationTile` — direct chats resolve peer avatar/displayName via `userProfileProvider` +
      `userStatusProvider`; group chats use group `avatarUrl` or generated initials via `ConversationAvatar`.
      `ChatScreenAppBar` — same live-resolve logic; shows online-dot for direct chats.
      Unread badge on `ConversationTile` now shows numeric count with colour-coded chip.
      Mute icon overlay (`Icons.volume_off`, cyan tint) on muted conversation avatars.
  - **TASK 67 — ConversationService Test Coverage (Sprint 18):**
    - BE: `ConversationServiceTest` expanded to 19 tests covering `muteConversation`, `unmuteConversation`,
      `archiveConversation`, `unarchiveConversation`, `markConversationUnread`, `markConversationRead`,
      idempotency guarantees, and participant-not-found guards.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 59/59** (ConversationServiceTest 19, all new Sprint 18 paths covered).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — BE `ConversationService.java` 411 lines, `ConversationController.java`
    239 lines; FE `FloatingReactionSheet` 180 lines, `ConversationTile` within 400-line limit.
  - **Files for Gemini QC:** BE — `model/Conversation.java`, `dto/ConversationResponse.java`,
    `service/ConversationService.java`, `controller/ConversationController.java`,
    `service/ConversationServiceTest.java`; FE — `domain/chat_state.dart`, `data/chat_repository.dart`,
    `domain/chat_provider.dart`, `ui/conversation_list_screen.dart`, `ui/widgets/conversation_tile.dart`,
    `ui/widgets/chat_app_bar.dart`, `ui/widgets/message_bubble.dart`,
    `ui/widgets/floating_reaction_sheet.dart`, `l10n/app_*.arb`.

- [2026-06-01] **SPRINT 13 (TASKS 49–51) → ✅ DONE (full vertical slices).**
  - **TASK 49 — Mention System (@username):**
    - BE: `Message` model gained `mentions` (List<String> of userIds). `MessageService.sendMessage`
      now calls `parseMentions(content, participants, senderId)` — short-circuits when content has no
      `@` (keeps the common path & unit tests off the users collection), else resolves each
      participant's `displayName` from the shared `users` collection and matches `@displayName`
      (case-insensitive). Resolved ids persist on the message + are returned in `MessageResponse.mentions`.
      `ChatController.send` sends a priority `MENTIONED_YOU` notification to mentioned participants
      (others still get `NEW_MESSAGE`).
    - FE: `MessageModel.mentions` parsed/threaded. `message_bubble._TextContent` is now a stateful
      consumer that highlights `@DisplayName` runs in Cyan via `Text.rich` + `TapGestureRecognizer`
      (tap → `/user/{id}` profile); recognizers are recreated/disposed per build. `ChatScreen` shows a
      floating `_MentionList` of group members while typing `@` (filters by query, inserts `@Name `).
      `ConversationsNotifier._onNotification` handles `MENTIONED_YOU` with a distinct in-app banner.
      i18n: `mentionNotificationTitle` + `mentionNotificationBody{name}` added to all 7 ARB.
  - **TASK 50 — Message Search:**
    - BE: `GET /api/messages/search?q=&conversationId=` (`MessageController`). `Message.content` annotated
      `@TextIndexed` (creates the Mongo text index per spec). `MessageService.searchMessages` enforces
      participant membership, case-insensitive substring match (regex, `Pattern.quote`-escaped) scoped to
      the conversation, excludes recalled/deleted-for-me and respects the user's clear-cutoff, newest first,
      capped at 50.
    - FE: `chat_repository.searchMessages`. `ChatScreen` AppBar search icon opens a full-screen
      `_SearchOverlay` (debounced query, results list). Tapping a result calls `ChatNotifier.jumpToMessage`
      (pages older history until loaded), then `_scrollToMessage` (GlobalKey + `Scrollable.ensureVisible`,
      nudging the lazy list when off-screen) and a 2s Cyan highlight (`ChatState.highlightMessageId`).
      i18n: `searchMessages`, `searchHint`, `searchNoResults` added to all 7 ARB.
  - **TASK 51 — Real Unread Count:** verified **already implemented** end-to-end and left intact —
    `ConversationService.getUnreadCounts` (aggregation: messages where `readBy` ∌ userId, grouped per
    conversation) populates `ConversationResponse.unreadCount`; `conversation_list_screen` renders a
    coloured numeric badge (`'${conv.unreadCount}'`) on each tile (not just a dot). No change needed.
  - **Tests:**
    - `mvn clean compile` → SUCCESS; `mvn test` → **BUILD SUCCESS, 45/45**
      (MessageServiceTest 21, incl. 4 new: search-returns-matches, search-blank-no-query,
      search-non-participant-throws, sendMessage-with-mention-resolves-ids).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** BE — `model/Message.java`, `dto/MessageResponse.java`,
    `service/MessageService.java`, `controller/MessageController.java`, `controller/ChatController.java`,
    `service/MessageServiceTest.java`; FE — `data/chat_repository.dart`, `domain/chat_state.dart`,
    `domain/chat_provider.dart`, `ui/chat_screen.dart`, `ui/widgets/message_bubble.dart`, `l10n/app_*.arb`.

---

## 🟡 SPRINT 22 — Messenger UI/UX & Auth Overhaul

### TASK 76 — Auth Screen & OTP 6-Box Improvements `PENDING`
#### SPEC
- **Frontend:**
  - Constrain widths of Login, Register, Forgot Password, OTP, and Reset Password screens to `maxWidth: 450` using `ConstrainedBox`. Center them horizontally.
  - Increase brand logo size to size `100` and make it prominent on all auth screens.
  - Create `Otp6BoxInput` custom widget in `pon_widgets.dart` (hidden `TextField` + 6 visible boxes with autofocus, selection indicators, and standard clipboard paste/backspace behavior).
  - Forgot password email submission redirects to `/verify-otp?email=...&isForgotPassword=true`.
  - OTP verification on `VerifyOtpScreen` redirects to `/new-password?email=...&otp=...` if `isForgotPassword == true`.
  - Hide/exclude the OTP input in `NewPasswordScreen` if `otp` query parameter is present (pre-fill automatically).
- **Test:** Verify auth fields do not stretch on Web. Verify entering email in Forgot Password goes to OTP screen, then redirects on success directly to New Password screen (without entering OTP twice).

### TASK 77 — Move Archived Chats to Settings `PENDING`
#### SPEC
- **Frontend:**
  - Remove `const ArchivedEntryTile()` from `ConversationListScreen`.
  - Add an "Archived Chats" list tile to `SettingsScreen` (using `Icons.archive_outlined`), navigating to `/archived`.
- **Test:** Verify Archived Chats option is present in Settings and works, and it is gone from the main conversation list.

### TASK 78 — Messenger-Style Chat Info Sidebar `PENDING`
#### SPEC
- **Frontend:**
  - Declare `showChatInfoSidebarProvider = StateProvider<bool>((ref) => false);` in `home_providers.dart`.
  - Update `ResponsiveHomeLayout` to support a 3-pane layout on Web (`width >= 800`): List Pane (350) | Chat Pane (Expanded) | Chat Info Sidebar (300) when `showChatInfoSidebarProvider` is true.
  - Add an info button to `ChatScreenAppBar` (exclamation circle icon) that toggles the sidebar on web, and opens full-screen info screens on mobile.
  - Create `ConversationInfoSidebar` widget under 400 lines displaying: Avatar, display name, encryption status ("Được mã hóa đầu cuối"), action row (Profile, Mute, Search), and collapsible panels for chat info, customize, files & media, and privacy & support.
  - **i18n:** Add `endToEndEncrypted`, `chatInfoCategory`, `customizeChatCategory`, `filesAndMediaCategory`, `privacyAndSupportCategory`, and `archivedChatsSubtitle` to all 7 `.arb` files.
- **Test:** Toggle info button on Web, verify right sidebar panel displays correctly with collapsible sections. Verify mobile tapping info icon still redirects to full screen.

---

## 🔴 SPRINT 23 HOTFIX — Profile Dialog & Chat Theme Fixes

### TASK 86 — Fix `UserProfileDialog` Edit Mode Bug `DONE`
#### SPEC
- **Frontend:**
  - Bug: `_initEditFields` is called on every `build()` while `_editMode == true`, causing controllers to reset to original values every time any state update triggers a rebuild (e.g., while the user is typing).
  - Fix: Add a `_fieldsInitialized` boolean flag to `_UserProfileDialogState`. Set it to `false` when toggling `_editMode = true` (in `onToggleEdit`). In `_initEditFields`, only execute initialization if `!_fieldsInitialized`, then set `_fieldsInitialized = true`.
  - UX: Ensure that after `_save()` completes successfully, `_fieldsInitialized` is reset to `false` so re-entering edit mode re-reads the updated profile.
- **Test:** Open self profile dialog → tap Edit → type a new name → trigger any state update → verify typed text is NOT reset.

### TASK 87 — Chat Theme: Image Upload instead of URL input `DONE`
#### SPEC
- **Frontend (`conversation_customisation_dialogs.dart`):**
  - In `showWallpaperDialog`, remove the `TextField` that asks for a URL.
  - Replace it with an "Upload Image" button (`Icons.add_photo_alternate_outlined`) that:
    1. Opens `ImagePicker` (gallery source, `imageQuality: 80`).
    2. Calls `chatRepositoryProvider.uploadFile(pickedFile)` to upload.
    3. Sets the returned URL as the wallpaper via `chatWallpaperProvider`.
    4. Sends `system.theme.changed:<url>` message.
    5. Closes the dialog.
  - Keep the preset color swatches as-is.
- **Test:** Open Chat Theme dialog → tap "Upload Image" → pick an image → verify the chat background changes to that image.

### TASK 88 — Nickname UX Clarity `VERIFIED`
#### SPEC
- **No backend change needed.** Nicknames are already conversation-scoped in `nicknamesProvider(conversationId)` (separate from user's actual `displayName`).
- **Frontend clarification:** In `showNicknamesDialog`, the list already shows all participants (including self and others). Verify that tapping a participant to set their nickname correctly updates only the conversation-local name, without touching `displayName`.
- **Verify:** The nickname set in conversation A does NOT appear in conversation B for the same user.
- **Note:** The `UserProfileDialog` edit mode edits the user's REAL profile fields (displayName, bio, gender, DOB, phone). Nicknames are managed separately via the info sidebar → Customize → Nicknames. These two are intentionally distinct.

---

## 🟢 SPRINT 24 — Voice Messages & Stickers

### TASK 89 — Voice Messages (Tin nhắn thoại) `DONE`
#### SPEC
- **Frontend:**
  - Add a microphone icon (`Icons.mic_none_outlined`) to `ChatInputBar` when the text input is empty.
  - Tap or hold the microphone icon to record audio using a standard recording package (e.g., `record`). Display a simple visual indicator (e.g. "Recording..." with elapsed time) in the input bar.
  - Once recording finishes, upload the audio file (`.m4a` or `.aac` file format) using the existing `chatRepositoryProvider.uploadFile()` API.
  - Send the uploaded audio URL as a chat message with `type: 'voice'`.
  - Create a custom `VoiceMessageBubble` widget for rendering `voice` type messages. The widget should feature:
    - A play/pause button (`Icons.play_arrow` and `Icons.pause`).
    - An interactive progress seek bar showing playback timeline.
    - Audio duration indicator (e.g. `0:15`).
    - Use `audioplayers` or similar player logic to manage playback state.
- **Test:** Verify that long-pressing/tapping the mic icon records audio. Verify that releasing/sending uploads it and displays a playable audio message card in the chat window.

### TASK 90 — Stickers Panel (Gửi nhãn dán) `DONE`
#### SPEC
- **Frontend:**
  - Add a dedicated "Stickers" tab to the bottom panel of the keyboard emoji selector (next to the Emoji tab).
  - Pre-load a set of 12-16 high-quality static sticker assets (stored under `assets/stickers/`).
  - Tapping a sticker sends it instantly as a chat message with `type: 'sticker'` and content set to the asset path (e.g., `assets/stickers/sticker1.png`).
  - Overhaul `MessageBubble` rendering: if the message type is `'sticker'`, render it as a transparent, clean image (width/height: ~120px) without the standard bubble background, borders, and margins, matching the sticker aesthetics of Telegram and Messenger.
- **Test:** Open the keyboard overlay → tap the Stickers tab → tap a sticker → verify that it is sent and rendered in the message stream as a transparent image with no bubble wrapper.


---

## 🟢 SPRINT AI-2 — Conversation Memory — DONE

> **Goal:** AI remembers conversation context across sessions. Short-term: last 20 messages (Redis cache). Long-term: MongoDB stores a compressed summary auto-generated after every 20 AI turns. User can view and delete memories from Flutter UI.
> **New MongoDB collection:** `ai_memories` (written by ai-service, read/deleted via chat-service REST)
> **Reference:** `.claude/rules/ai-service.md`, `docs/decisions.md` (ADR-007, ADR-008), `docs/roadmap.md` (Sprint AI-2)

---

### PHASE 1 — Context Window Quality

### TASK AI-2.1 — Expand & clean conversation history payload `DONE`
#### SPEC
- **File:** `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java`
  - Increase history fetch: use `messageRepository.findTop20ByConversationIdOrderByCreatedAtDesc(convId)` (was top 10)
  - Filter out non-textual messages before mapping to history: exclude entries where `type` is in `{"voice", "file", "sticker", "system", "call_log"}` — only keep `"text"` and `"ai"` types
  - Correct role mapping: `senderId.equals(AiConstants.AI_BOT_USER_ID)` → role `"assistant"`, others → `"user"`
  - Strip `@AI`/`@ponai` mention text from history entries (reuse regex `(?i)@(AI|ponai)\b`), trim whitespace
- **Test:** `ChatControllerTest` — add test verifying history excludes voice/sticker/file messages and maps bot messages to role `"assistant"`.

---

### PHASE 2 — Long-Term Memory (MongoDB)

### TASK AI-2.2 — `ai_memories` collection + MemoryService (ai-service) `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/memory/ai-memory.schema.ts`
  - Mongoose schema `AiMemory` with fields:
    ```typescript
    conversationId: String (required, indexed)
    userId: String (required, indexed)       // the human user of the conversation
    summary: String (required)              // AI-generated summary paragraph
    keyFacts: [String]                      // array of bullet-point facts extracted from summary
    messageCount: Number (default 0)        // total AI turns processed so far
    updatedAt: Date (default Date.now)
    ```
  - Compound index on `{ conversationId: 1, userId: 1 }` (unique)
- **New file:** `apps/server/ai-service/src/memory/memory.service.ts`
  - `MemoryService` injectable service with `@InjectModel(AiMemory.name)`
  - `getMemory(conversationId: string): Promise<AiMemory | null>` — find by conversationId
  - `upsertMemory(conversationId: string, userId: string, summary: string, keyFacts: string[], messageCount: number): Promise<void>` — findOneAndUpdate with upsert
  - `deleteMemory(conversationId: string): Promise<void>`
  - `incrementMessageCount(conversationId: string): Promise<number>` — returns updated count
- **New file:** `apps/server/ai-service/src/memory/memory.module.ts` — exports `MemoryService`, imports `MongooseModule.forFeature([{ name: AiMemory.name, schema: AiMemorySchema }])`
- **Update:** `apps/server/ai-service/src/app.module.ts` — import `MemoryModule`

### TASK AI-2.3 — Auto-summarization trigger `DONE`
#### SPEC
- **File:** `apps/server/ai-service/src/ai/ai.service.ts`
  - Inject `MemoryService`
  - After stream completes (in `handleRequest()`), call `memoryService.incrementMessageCount(conversationId)`
  - If returned count is divisible by 20 (i.e., `count % 20 === 0`): trigger summarization **asynchronously** (do NOT await inline — use `.then().catch()` to avoid blocking the stream response)
  - **Summarization logic** (private method `_generateSummary(conversationId, userId, history)`):
    1. Build a summarization prompt: system = `"You are a memory assistant. Summarize the conversation below in 2-3 sentences, then extract up to 5 key facts about the user as a JSON array."`, messages = last 20 entries from `payload.history`
    2. Call `this.anthropic.messages.create({ model: primaryModel, max_tokens: 512, system, messages })` (non-streaming)
    3. Parse response: expect plain text summary first, then `FACTS: ["fact1", "fact2", ...]` at the end. Regex: `FACTS:\s*(\[.*?\])`; if parse fails, use empty array
    4. Call `memoryService.upsertMemory(conversationId, userId, summary, keyFacts, count)`
    5. Log success or error with `this.logger`
  - **System prompt format for summarization:**
    ```
    You are a memory assistant. Summarize the following conversation in 2-3 sentences focusing on what the user talked about and any important information they shared.
    Then on a new line write: FACTS: followed by a JSON array of up to 5 short fact strings about the user.
    Example format:
    The user discussed their Flutter project and asked about Redis pub/sub architecture.
    FACTS: ["Works on a Flutter + Spring Boot project called PON", "Uses Redis for message queue", "Interested in AI integration"]
    ```
- **Test:** `ai.service.spec.ts` — add test: after 20th interaction, `_generateSummary` is called; mock Anthropic non-streaming response, verify `memoryService.upsertMemory` is called with parsed data.

### TASK AI-2.4 — Inject long-term memory into system prompt `DONE`
#### SPEC
- **File:** `apps/server/ai-service/src/ai/ai.service.ts`
  - In `handleRequest()`, before building the system prompt: `const memory = await this.memoryService.getMemory(payload.conversationId)`
  - If memory exists, append to system prompt:
    ```
    \n\n## Memory from previous conversations:\n{memory.summary}\n\nKey facts about this user:\n{memory.keyFacts.map(f => `- ${f}`).join('\n')}
    ```
  - If memory is null: system prompt stays as-is (no change to behavior)
- **Test:** `ai.service.spec.ts` — mock `memoryService.getMemory` returning a memory object, verify the system prompt passed to Anthropic contains the memory section.

---

### PHASE 3 — REST API & Flutter UI

### TASK AI-2.5 — Memory REST API (chat-service) `DONE`
#### SPEC
Since MongoDB is shared, chat-service reads/deletes memories directly — no HTTP call between services needed.
- **New file:** `apps/server/chat-service/src/main/java/com/platform/chatservice/model/AiMemory.java`
  - `@Document(collection = "ai_memories")`, fields matching ai-service schema: `id, conversationId, userId, summary, keyFacts (List<String>), messageCount, updatedAt`
- **New file:** `apps/server/chat-service/src/main/java/com/platform/chatservice/repository/AiMemoryRepository.java`
  - `MongoRepository<AiMemory, String>`
  - `Optional<AiMemory> findByConversationId(String conversationId)`
  - `List<AiMemory> findByUserId(String userId)`
  - `void deleteByConversationId(String conversationId)`
- **New file:** `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/AiMemoryResponse.java`
  - Fields: `conversationId, summary, keyFacts, messageCount, updatedAt`
- **New file:** `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/AiMemoryController.java`
  - `GET /api/ai/memories` → returns `List<AiMemoryResponse>` for the authenticated user (extracted from JWT, filtered by `userId`)
  - `GET /api/ai/memories/{conversationId}` → returns `AiMemoryResponse` for specific conversation (verify userId ownership before returning)
  - `DELETE /api/ai/memories/{conversationId}` → delete memory (verify userId ownership), return 204
- **Security:** All endpoints require JWT (`@PreAuthorize("isAuthenticated()")` or via existing `SecurityConfig`)
- **Test:** `AiMemoryControllerTest.java` — mock `AiMemoryRepository`, test: GET returns user's memories only, DELETE returns 204 and calls repository, DELETE with wrong userId returns 403.

### TASK AI-2.6 — Flutter: AI Memory screen `DONE`
#### SPEC
- **New file:** `apps/client/lib/features/chat/data/ai_memory_repository.dart`
  - `getMyMemories(): Future<List<AiMemoryModel>>` → `GET /api/ai/memories`
  - `getConversationMemory(String conversationId): Future<AiMemoryModel?>` → `GET /api/ai/memories/{conversationId}`
  - `deleteMemory(String conversationId): Future<void>` → `DELETE /api/ai/memories/{conversationId}`
- **New file:** `apps/client/lib/features/chat/domain/ai_memory_model.dart`
  - `AiMemoryModel` with: `conversationId, summary, keyFacts (List<String>), messageCount, updatedAt`; `fromJson` factory
- **New file:** `apps/client/lib/features/chat/domain/ai_memory_provider.dart`
  - `aiMemoriesProvider`: `AsyncNotifierProvider<AiMemoriesNotifier, List<AiMemoryModel>>`
  - `AiMemoriesNotifier`: `build()` calls `aiMemoryRepository.getMyMemories()`, `deleteMemory(conversationId)` calls repo then removes from state (optimistic)
- **New file:** `apps/client/lib/features/chat/ui/ai_memory_screen.dart` (≤ 400 lines)
  - `AiMemoryScreen` — `ConsumerWidget`, shows list of memories with:
    - Each tile: conversation avatar + summary text (2-line truncated) + message count chip + updatedAt
    - Long-press or swipe → confirm delete dialog → calls `notifier.deleteMemory()`
    - Empty state: `Icons.psychology_outlined` icon + `l10n.aiMemoryEmptyState` text
  - AppBar: `l10n.aiMemoryTitle`
- **New route:** `/ai-memories` in `app_router.dart`
- **Access point:** In `ChatScreenAppBar`, when conversation is with AI bot → add "View Memory" option in overflow menu → navigates to `/ai-memories`
- **i18n:** Add to all 7 ARB files: `"aiMemoryTitle"`, `"aiMemoryEmptyState"`, `"aiMemoryDeleteConfirm"`, `"aiMemoryDeleted"`, `"aiMemoryUpdated"`, `"aiMemoryFacts"`, `"viewAiMemory"`
- Run `flutter gen-l10n` after adding keys

### TASK AI-2.7 — i18n + Tests + Verification `DONE`
#### SPEC
- Verify all 7 i18n keys from AI-2.6 exist in all 7 ARB files (`en, vi, zh, ja, ko, es, fr`)
- **ai-service tests** (`pnpm test`):
  - `memory.service.spec.ts`: mock Mongoose model, test `upsertMemory`, `getMemory`, `deleteMemory`, `incrementMessageCount`
  - `ai.service.spec.ts` (extend): test memory injection into system prompt when memory exists; test auto-summarize called at messageCount=20,40,60
- **chat-service tests** (`mvn test`):
  - `AiMemoryControllerTest.java` (from AI-2.5) must pass
  - All existing 66 tests must still pass
- **Flutter** (`flutter analyze && flutter test`): 0 new issues
- **Append to QA LOG** with results

---


---

## 🟢 SPRINT AI-3 — Knowledge Base (RAG) — DONE

> **Goal:** User uploads PDF/DOCX/TXT into a conversation → AI answers questions based on document content with source citation.
> **New infra:** Qdrant vector DB (Docker, port 6333) + OpenAI embeddings API (`text-embedding-3-small`)
> **New Redis channels:** `kb:process` (chat-service → ai-service) | `kb:status:{documentId}` (ai-service → chat-service)
> **New MongoDB collection:** `kb_documents`
> **Reference:** `.claude/rules/ai-service.md`, `docs/decisions.md`, `docs/roadmap.md` (Sprint AI-3)

---

### PHASE 1 — Infrastructure

### TASK AI-3.1 — Add Qdrant + OpenAI embeddings to stack `DONE`
#### SPEC
- **File:** `infra/docker-compose/compose.yml`
  - Add `qdrant` service:
    ```yaml
    qdrant:
      image: qdrant/qdrant:v1.9.0
      container_name: chat-qdrant
      ports:
        - "6333:6333"
      volumes:
        - qdrant_data:/qdrant/storage
      networks:
        - app-net
    ```
  - Add `qdrant_data` to `volumes:` block
  - Add `QDRANT_URL: http://qdrant:6333` and `OPENAI_API_KEY: ${OPENAI_API_KEY}` to `ai-service` environment block
  - Add `ai-service` depends_on `qdrant: condition: service_started`
- **File:** `apps/server/ai-service/` — install deps:
  - `pnpm add @qdrant/js-client-rest openai`
- **File:** `apps/server/ai-service/src/config/configuration.ts`
  - Add to config object: `qdrant: { url: process.env.QDRANT_URL || 'http://localhost:6333' }`, `openai: { apiKey: process.env.OPENAI_API_KEY }`, `kb: { chunkSize: 512, chunkOverlap: 80, topK: 4, embeddingModel: 'text-embedding-3-small', qdrantCollection: 'knowledge' }`
- **File:** `apps/server/ai-service/.env.example` — add `OPENAI_API_KEY=`, `QDRANT_URL=http://localhost:6333`
- **Test:** `docker compose up qdrant -d` → `curl http://localhost:6333/healthz` → `{"title":"qdrant - ..."}`

---

### PHASE 2 — Document Processing Pipeline (ai-service)

### TASK AI-3.2 — Document text extraction + chunker `DONE`
#### SPEC
- **New module:** `apps/server/ai-service/src/kb/` — create `kb.module.ts`, export all services below
- **New deps:** `pnpm add pdf-parse mammoth` (PDF + DOCX extraction), `pnpm add -D @types/pdf-parse`
- **New file:** `apps/server/ai-service/src/kb/document-extractor.service.ts`
  - `extractText(buffer: Buffer, mimeType: string): Promise<string>`
    - `application/pdf` → `pdf-parse(buffer)` → `result.text`
    - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `mammoth.extractRawText({ buffer })` → `result.value`
    - `text/plain` → `buffer.toString('utf-8')`
    - Other: throw `UnsupportedFileTypeException`
- **New file:** `apps/server/ai-service/src/kb/text-chunker.service.ts`
  - `chunk(text: string, chunkSize = 512, overlap = 80): string[]`
    - Clean text: collapse multiple whitespace/newlines to single space, trim
    - Split by sentence boundaries first (regex `(?<=[.!?])\s+`), then merge sentences into chunks ≤ chunkSize chars
    - Slide window with `overlap` chars carried over into next chunk
    - Discard chunks shorter than 50 chars
    - Return `string[]`
- **Test:** `document-extractor.service.spec.ts` — mock `pdf-parse` and `mammoth`, test correct branch per mimeType. `text-chunker.service.spec.ts` — test: 1000-char text → correct number of chunks, overlap preserved, short chunks discarded.

### TASK AI-3.3 — Embedding service + Qdrant storage `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/kb/embedding.service.ts`
  - Inject `ConfigService`; constructor creates `new OpenAI({ apiKey })` client
  - `embed(texts: string[]): Promise<number[][]>` — calls `openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })`, returns array of float vectors. Batch: if `texts.length > 100`, split into sub-batches of 100.
  - `embedOne(text: string): Promise<number[]>` — calls `embed([text])`, returns first vector
- **New file:** `apps/server/ai-service/src/kb/vector-store.service.ts`
  - Inject `ConfigService`; constructor creates `new QdrantClient({ url })` client
  - `ensureCollection(collectionName: string, vectorSize = 1536): Promise<void>` — `client.getCollection()` → if not found, `client.createCollection({ vectorsConfig: { size: vectorSize, distance: 'Cosine' } })`
  - `upsertChunks(collectionName: string, documentId: string, chunks: string[], vectors: number[][]): Promise<void>` — map to points `{ id: uuid(), vector, payload: { documentId, text, chunkIndex } }`, `client.upsert(collectionName, { points })`
  - `search(collectionName: string, queryVector: number[], topK = 4, filterDocumentIds?: string[]): Promise<Array<{ text: string, documentId: string, score: number }>>` — `client.search({ vector: queryVector, limit: topK, filter: filterDocumentIds ? { must: [{ key: 'documentId', match: { any: filterDocumentIds } }] } : undefined, withPayload: true })`
  - `deleteDocument(collectionName: string, documentId: string): Promise<void>` — `client.delete(collectionName, { filter: { must: [{ key: 'documentId', match: { value: documentId } }] } })`
- **Test:** `vector-store.service.spec.ts` — mock `QdrantClient`, test `upsertChunks` calls correct Qdrant methods, `search` applies filter, `deleteDocument` calls delete with correct filter.

### TASK AI-3.4 — KB processing Redis pipeline (ai-service) `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/kb/kb-processor.service.ts`
  - Inject `DocumentExtractorService`, `TextChunkerService`, `EmbeddingService`, `VectorStoreService`, `RedisPublisherService`, `ConfigService`, `@InjectModel(KbDocument.name) kbDocumentModel`
  - `processDocument(payload: KbProcessPayload): Promise<void>`
    1. Fetch file bytes: `fetch(payload.fileUrl)` → `Buffer.from(await res.arrayBuffer())`
    2. Extract text via `documentExtractorService.extractText(buffer, payload.mimeType)`
    3. Chunk via `textChunkerService.chunk(text)`
    4. Embed all chunks: `embeddingService.embed(chunks)`
    5. Ensure Qdrant collection: `vectorStoreService.ensureCollection('knowledge')`
    6. Upsert: `vectorStoreService.upsertChunks('knowledge', payload.documentId, chunks, vectors)`
    7. Update MongoDB `kb_documents` status to `"done"`, set `chunkCount`
    8. Publish to Redis `kb:status:{documentId}`: `{ type: 'KB_DONE', documentId, chunkCount }`
    - On any error: update status to `"error"`, publish `{ type: 'KB_ERROR', documentId, error: message }`
- **New file:** `apps/server/ai-service/src/kb/kb-process-payload.interface.ts`
  - `interface KbProcessPayload { documentId: string; conversationId: string; userId: string; fileUrl: string; mimeType: string; fileName: string; }`
- **Update:** `apps/server/ai-service/src/redis/redis-subscriber.service.ts`
  - Subscribe to `kb:process` channel in addition to `ai:request`
  - On `kb:process` message: parse JSON → call `kbProcessorService.processDocument(payload)` (async, catch errors)
- **New file:** `apps/server/ai-service/src/kb/kb-document.schema.ts` (Mongoose)
  - Fields: `documentId (String, required, unique)`, `conversationId (String, required)`, `userId (String)`, `fileName (String)`, `mimeType (String)`, `status: "pending"|"processing"|"done"|"error"`, `chunkCount (Number, default 0)`, `uploadedAt (Date, default now)`
  - NOTE: This schema is a local cache/status tracker in ai-service. The canonical record lives in chat-service's `kb_documents` collection.
- **Update:** `apps/server/ai-service/src/kb/kb.module.ts` — wire all services, import `MongooseModule`, `RedisModule`; export `KbProcessorService`, `VectorStoreService`, `EmbeddingService`
- **Update:** `apps/server/ai-service/src/app.module.ts` — import `KbModule`

---

### PHASE 3 — chat-service REST API

### TASK AI-3.5 — KB document CRUD (chat-service) `DONE`
#### SPEC
- **New file:** `apps/server/chat-service/.../model/KbDocument.java`
  - `@Document(collection = "kb_documents")`, fields: `id (String @Id)`, `documentId (String, indexed unique)`, `conversationId (String, indexed)`, `userId (String)`, `fileName (String)`, `mimeType (String)`, `fileUrl (String)`, `status ("pending"|"processing"|"done"|"error")`, `chunkCount (int, default 0)`, `uploadedAt (Instant, @CreatedDate)`
- **New file:** `...repository/KbDocumentRepository.java`
  - `List<KbDocument> findByConversationIdOrderByUploadedAtDesc(String conversationId)`
  - `Optional<KbDocument> findByDocumentId(String documentId)`
  - `void deleteByDocumentId(String documentId)`
- **New file:** `...dto/KbDocumentResponse.java` — fields: `documentId, fileName, mimeType, status, chunkCount, uploadedAt`
- **New file:** `...dto/KbUploadRequest.java` — fields: `conversationId (required)`, `fileName (required)`, `mimeType (required)`, `fileUrl (required)` (URL from existing GridFS upload)
- **New file:** `...controller/KbController.java`
  - `POST /api/kb/documents` — body `KbUploadRequest`; verify caller is participant of `conversationId`; generate `documentId = UUID.randomUUID().toString()`; save `KbDocument` with status `"pending"`; publish to Redis `kb:process` via `StringRedisTemplate` with JSON payload `{ documentId, conversationId, userId, fileUrl, mimeType, fileName }`; return `KbDocumentResponse` 201
  - `GET /api/kb/documents?conversationId={id}` — verify caller is participant; return `List<KbDocumentResponse>` sorted newest-first
  - `DELETE /api/kb/documents/{documentId}` — verify caller is participant; delete from `kb_documents`; publish to Redis `kb:delete` channel with `{ documentId }` so ai-service removes vectors from Qdrant; return 204
  - Subscribe `kb:status:*` pattern in a new `KbStatusListener.java` (`MessageListener`): on `KB_DONE` → update `KbDocument.status = "done"`, `chunkCount`; on `KB_ERROR` → update `status = "error"`; broadcast `{ type: "KB_STATUS_UPDATE", documentId, status, chunkCount }` to `/topic/conversation/{conversationId}` via `SimpMessagingTemplate`
- **Update:** `config/RedisListenerConfig.java` — register `KbStatusListener` with `PatternTopic("kb:status:*")`
- **Handle `kb:delete` in ai-service:** in `redis-subscriber.service.ts`, subscribe to `kb:delete`; on message call `vectorStoreService.deleteDocument('knowledge', documentId)`
- **Test:** `KbControllerTest.java` — test upload creates document + publishes Redis; GET returns list; DELETE returns 204.

---

### PHASE 4 — RAG Query Pipeline

### TASK AI-3.6 — Inject RAG context into AI response `DONE`
#### SPEC
- **File:** `apps/server/ai-service/src/ai/ai.service.ts`
  - Inject `VectorStoreService`, `EmbeddingService`
  - In `handleRequest()`, after fetching memory (AI-2.4), before building final system prompt:
    1. Check if conversation has any documents: query MongoDB `KbDocument` model for `{ conversationId, status: "done" }` — `const hasDocs = count > 0`
    2. If `hasDocs`: embed `payload.content` → `embeddingService.embedOne(payload.content)` → search Qdrant → `vectorStoreService.search('knowledge', queryVector, 4, documentIds)`
    3. If results found (score > 0.3 threshold): build context block:
       ```
       ## Relevant Knowledge Base Context:
       {results.map((r, i) => `[Source ${i+1}] ${r.text}`).join('\n\n')}
       Use the above context to answer the user's question. Cite sources as [Source N] inline.
       ```
    4. Append context block to system prompt (after memory block if present)
    5. Include `sources` in the `AI_STREAM_DONE` payload: `{ type: 'AI_STREAM_DONE', fullContent, sources: [{ documentId, score }] }` — only chunks with score > 0.3
  - If no docs or Qdrant error: degrade gracefully (log warning, continue without RAG)
- **Test:** `ai.service.spec.ts` — mock `VectorStoreService.search` returning 2 chunks; verify system prompt contains `[Source 1]` and `[Source 2]`; verify `AI_STREAM_DONE` payload includes `sources` array.

---

### PHASE 5 — Flutter UI

### TASK AI-3.7 — KB status STOMP listener + citation bubble (Flutter) `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/data/stomp_service.dart`
  - Add `StreamController<Map<String,dynamic>> _kbStatusCtrl` (broadcast)
  - In `_doSubscribeConversation`: add case `type == "KB_STATUS_UPDATE"` → emit to `_kbStatusCtrl`
  - Expose `Stream<Map<String,dynamic>> get kbStatusEvents => _kbStatusCtrl.stream`
- **File:** `apps/client/lib/features/chat/domain/chat_state.dart`
  - Add to `MessageModel`: `final List<String>? sources` (documentIds that were cited, nullable)
  - Update `fromJson` to parse `sources` from AI_STREAM_DONE payload
- **File:** `apps/client/lib/features/chat/ui/widgets/streaming_ai_bubble.dart` (or `message_bubble.dart`)
  - After AI message finalizes (isStreaming=false), if `message.sources != null && message.sources!.isNotEmpty`:
    - Show small citation row below bubble: `Icons.auto_stories` icon + `"${sources.length} source(s)"` text in grey italic
    - Tapping citation row navigates to `/kb/{conversationId}` (the KB management screen)

### TASK AI-3.8 — Flutter: Knowledge Base management screen `DONE`
#### SPEC
- **New file:** `apps/client/lib/features/chat/data/kb_repository.dart`
  - `uploadDocument(String conversationId, String fileUrl, String fileName, String mimeType): Future<KbDocumentModel>` → `POST /api/kb/documents`
  - `getDocuments(String conversationId): Future<List<KbDocumentModel>>` → `GET /api/kb/documents?conversationId=`
  - `deleteDocument(String documentId): Future<void>` → `DELETE /api/kb/documents/{documentId}`
- **New file:** `apps/client/lib/features/chat/domain/kb_document_model.dart`
  - `KbDocumentModel { documentId, fileName, mimeType, status, chunkCount, uploadedAt }`; `fromJson`, `isReady` getter (`status == 'done'`)
- **New file:** `apps/client/lib/features/chat/domain/kb_provider.dart`
  - `kbDocumentsProvider(String conversationId)`: `AsyncNotifierProviderFamily`
  - `KbNotifier`: `build(conversationId)` → fetch docs; `upload(fileUrl, fileName, mimeType)` → call repo, optimistic add with `status: "pending"`; `delete(documentId)` → call repo, remove from state
  - Listen to `stompService.kbStatusEvents` in build — update document status when `KB_STATUS_UPDATE` arrives
- **New file:** `apps/client/lib/features/chat/ui/kb_screen.dart` (≤ 400 lines)
  - `KbScreen(String conversationId)` — `ConsumerWidget`
  - AppBar: `l10n.kbTitle` + upload FAB (`Icons.upload_file`)
  - Upload FAB: open file picker (`file_picker`, allow PDF/DOCX/TXT), upload via existing `chatRepository.uploadDocument(bytes, name)` to get URL, then `kbNotifier.upload(url, name, mimeType)`
  - List: each tile shows `Icons.description`, `fileName`, status chip (`processing` → amber spinner, `done` → green check, `error` → red X), `chunkCount` pages, swipe-to-delete with confirm dialog
  - Empty state: `Icons.folder_open` + `l10n.kbEmptyState`
- **New route:** `/kb/:conversationId` in `app_router.dart`
- **Access point:** In `ChatScreenAppBar` overflow menu → `l10n.kbManage` option → navigates to `/kb/{conversationId}` (show for all conversations, not just AI bot)
- **i18n:** Add to all 7 ARB files: `"kbTitle"`, `"kbEmptyState"`, `"kbUploadButton"`, `"kbDeleteConfirm"`, `"kbProcessing"`, `"kbReady"`, `"kbError"`, `"kbManage"`, `"kbSources"`, `"kbChunks"`
- Run `flutter gen-l10n` after adding keys

### TASK AI-3.9 — i18n + Tests + Verification `DONE`
#### IMPL NOTES
- 10 KB keys (kbTitle, kbEmptyState, kbUploadButton, kbDeleteConfirm, kbProcessing, kbReady, kbError, kbManage, kbSources, kbChunks) added to all 7 ARB files (en/vi/zh/ja/ko/es/fr)
- `flutter gen-l10n` → generated successfully ✅
- ai-service: 33/33 tests pass (5 suites) ✅
- chat-service: 78/78 tests pass (7 suites, incl. KbControllerTest 5/5) ✅
- flutter analyze: 0 errors (1 pre-existing info warning in chat_provider.dart) ✅
- flutter test: 1/1 pass ✅
- Qdrant: `curl http://localhost:6333/healthz` → `healthz check passed` ✅

---

## QA LOG — Sprint AI-3 [2026-06-06]

| Task | Status | Notes |
|------|--------|-------|
| AI-3.1 Qdrant + OpenAI infra | ✅ PASS | docker-compose qdrant healthy, config & env vars added |
| AI-3.2 Document extractor + chunker | ✅ PASS | pdf-parse (CJS require), mammoth, 512-char sliding window |
| AI-3.3 Embedding + VectorStore | ✅ PASS | OpenAI text-embedding-3-small, Qdrant collection "knowledge" |
| AI-3.4 KB processing pipeline | ✅ PASS | kb:process / kb:status:{docId} / kb:delete Redis channels |
| AI-3.5 KB CRUD (chat-service) | ✅ PASS | KbController + KbStatusListener + KbDocumentRepository |
| AI-3.6 RAG context injection | ✅ PASS | score ≥ 0.3, graceful degrade, sources in AI_STREAM_DONE |
| AI-3.7 KB status + citation bubble | ✅ PASS | STOMP KB_STATUS_UPDATE, FinalizedAiBubble citation row |
| AI-3.8 Flutter KB screen | ✅ PASS | KbScreen ≤ 400 lines, /kb/:conversationId route, AppBar menu |
| AI-3.9 i18n + tests + verification | ✅ PASS | All 7 locales, all tests green, Qdrant healthy |

---


---

## 🟢 SPRINT AI-4 — Tool System (Agentic Loop) — DONE

> **Goal:** AI can take actions inside the chat app — search messages, look up user info, query knowledge base, create reminders, summarize conversations. User sees inline "AI is searching..." indicators and a collapsible tool trace below each AI response.
> **Pattern:** Non-streaming agentic loop (tool iterations) → streaming final response
> **New Redis event:** `AI_TOOL_CALL` (ai-service → chat-service → STOMP → Flutter)
> **New MongoDB collection:** `reminders`
> **Reference:** `.claude/rules/ai-service.md`, `docs/decisions.md`, `docs/roadmap.md` (Sprint AI-4)

---

### PHASE 1 — Tool Framework (ai-service)

### TASK AI-4.1 — Tool service: definitions + executor `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/tools/tool.interface.ts`
  ```typescript
  export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
  }
  export interface ToolContext {
    conversationId: string;
    userId: string;
    displayName: string;
  }
  ```
- **New file:** `apps/server/ai-service/src/tools/tool-registry.service.ts`
  - `getDefinitions(): ToolDefinition[]` — returns array of all registered tool schemas (5 tools)
  - `execute(toolName: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string>` — dispatches to the correct tool service, returns result as a plain string (JSON or prose). On unknown tool: return `"Tool not found: {toolName}"`. On error: return `"Tool error: {message}"` (never throw — tool errors should not crash the agentic loop)
- **New file:** `apps/server/ai-service/src/tools/tools.module.ts` — exports `ToolRegistryService` and all tool services; imports `MongooseModule`, `KbModule`, `MemoryModule`
- **Update:** `apps/server/ai-service/src/app.module.ts` — import `ToolsModule`

### TASK AI-4.2 — Tools: `search_messages` + `get_user_info` `DONE`
#### SPEC
Both tools read MongoDB directly (shared `platform` DB — no HTTP to chat-service needed).

- **New file:** `apps/server/ai-service/src/tools/search-messages.tool.ts`
  - Tool definition:
    ```json
    {
      "name": "search_messages",
      "description": "Search for messages in the current conversation by keyword. Use when the user asks to find, recall, or look up something said earlier.",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Keyword or phrase to search for" },
          "limit": { "type": "number", "description": "Max results to return (default 5, max 10)" }
        },
        "required": ["query"]
      }
    }
    ```
  - `execute(input, ctx)`: inject `@InjectConnection()` Mongoose connection; query `messages` collection: `{ conversationId: ctx.conversationId, content: { $regex: input.query, $options: 'i' }, type: { $in: ['text', 'ai'] }, recalled: { $ne: true } }`, sort by `createdAt: -1`, limit `Math.min(input.limit ?? 5, 10)`
  - Return: JSON string `[{ content, senderDisplayName, createdAt }]` — resolve `senderDisplayName` from `users` collection by `senderId`; if no results return `"No messages found matching '${query}'"`

- **New file:** `apps/server/ai-service/src/tools/get-user-info.tool.ts`
  - Tool definition:
    ```json
    {
      "name": "get_user_info",
      "description": "Get profile information about the user you are chatting with.",
      "input_schema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
    ```
  - `execute(input, ctx)`: query `users` collection by `_id: ctx.userId`; return JSON string `{ displayName, bio, gender, dateOfBirth, phone }` — omit null fields. If not found: `"User not found"`

### TASK AI-4.3 — Tools: `search_knowledge_base` + `summarize_conversation` `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/tools/search-knowledge-base.tool.ts`
  - Inject `EmbeddingService`, `VectorStoreService`
  - Tool definition: `name: "search_knowledge_base"`, description: `"Search uploaded documents in the knowledge base for relevant information"`, input: `{ query: string (required), topK: number (optional, default 3) }`
  - `execute(input, ctx)`: `embedOne(input.query)` → `vectorStoreService.search('knowledge', vector, topK ?? 3)` filtered by `conversationId` documents; return formatted string `"Result 1: {text}\n\nResult 2: {text}..."`. If no results: `"No relevant documents found"`

- **New file:** `apps/server/ai-service/src/tools/summarize-conversation.tool.ts`
  - Inject `MemoryService`
  - Tool definition: `name: "summarize_conversation"`, description: `"Get a summary of the conversation history and key facts remembered about the user"`, input: `{}` (no inputs required)
  - `execute(input, ctx)`: `memoryService.getMemory(ctx.conversationId)`; if found return `"Summary: {summary}\n\nKey facts:\n{keyFacts.map(f => '- ' + f).join('\n')}"`; if null return `"No conversation summary available yet"`

### TASK AI-4.4 — Tool: `create_reminder` + `reminders` collection `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/tools/reminder.schema.ts`
  - Mongoose schema `Reminder`: `userId (String, required, indexed)`, `conversationId (String, required)`, `text (String, required)`, `remindAt (Date, required)`, `done (Boolean, default false)`, `createdAt (Date, default now)`
- **New file:** `apps/server/ai-service/src/tools/create-reminder.tool.ts`
  - Inject `@InjectModel(Reminder.name)`
  - Tool definition:
    ```json
    {
      "name": "create_reminder",
      "description": "Create a reminder for the user at a specific date and time.",
      "input_schema": {
        "type": "object",
        "properties": {
          "text": { "type": "string", "description": "What to remind the user about" },
          "remindAt": { "type": "string", "description": "ISO 8601 datetime string for when to send the reminder" }
        },
        "required": ["text", "remindAt"]
      }
    }
    ```
  - `execute(input, ctx)`: validate `remindAt` is a valid future date (throw if past → return error string); save `Reminder` to MongoDB; return `"Reminder set: '${text}' at ${formattedDate}"`
- **Update:** `apps/server/ai-service/src/tools/tools.module.ts` — add `MongooseModule.forFeature([{ name: Reminder.name, schema: ReminderSchema }])`

---

### PHASE 2 — Agentic Loop

### TASK AI-4.5 — Agentic loop in AiService `DONE`
#### SPEC
- **File:** `apps/server/ai-service/src/ai/ai.service.ts`
  - Inject `ToolRegistryService`
  - Replace `handleRequest()` body with agentic loop:
    ```
    const tools = this.toolRegistry.getDefinitions();
    const ctx: ToolContext = { conversationId, userId, displayName };
    let messages = [...history, { role: 'user', content }];
    const MAX_ITER = 5;
    let iteration = 0;
    const toolTrace: { toolName, inputSummary, resultSummary }[] = [];

    while (iteration < MAX_ITER) {
      // Non-streaming call to detect tool_use
      const response = await this.anthropic.messages.create({
        model, max_tokens: 4096, system, messages, tools,
        tool_choice: { type: 'auto' }
      });

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const block of toolUseBlocks) {
          // Publish AI_TOOL_CALL event so Flutter shows indicator
          await publisher.publish(convId, {
            type: 'AI_TOOL_CALL',
            toolName: block.name,
            inputSummary: JSON.stringify(block.input).slice(0, 100)
          });
          const result = await toolRegistry.execute(block.name, block.input, ctx);
          toolTrace.push({ toolName: block.name, inputSummary: ..., resultSummary: result.slice(0, 200) });
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }

        // Append assistant turn + tool results and loop
        messages = [...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        ];
        iteration++;
        continue;
      }

      // stop_reason === 'end_turn' — stream the final text response
      break;
    }

    // Stream final answer (same streaming pattern as before)
    const stream = await this.anthropic.messages.stream({ model, max_tokens: 2048, system, messages });
    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        await publisher.publish(convId, { type: 'AI_STREAM_CHUNK', chunk: chunk.delta.text });
      }
    }
    await publisher.publish(convId, {
      type: 'AI_STREAM_DONE', fullContent: fullText,
      sources: lastRagSources,   // from RAG (AI-3.6)
      toolTrace                  // new field
    });
    ```
  - If MAX_ITER reached with no `end_turn`: publish `AI_STREAM_DONE` with whatever the last `end_turn` text content was (or fallback message `"I had trouble completing that action. Please try again."`)
  - Wrap full loop in existing try/catch fallback logic (primary model → fallback model → AI_STREAM_ERROR)
- **Test:** `ai.service.spec.ts` — test: (1) single tool call → final stream; (2) two consecutive tool calls → final stream; (3) MAX_ITER=1 exhausted → fallback message published; (4) tool executor throws → error string returned, loop continues.

---

### PHASE 3 — Flutter UI

### TASK AI-4.6 — Forward `AI_TOOL_CALL` via STOMP (chat-service) `DONE`
#### SPEC
- **File:** `apps/server/chat-service/.../service/AiResponseListener.java`
  - Add case `AI_TOOL_CALL`:
    ```java
    case "AI_TOOL_CALL" -> messagingTemplate.convertAndSend(
        "/topic/conversation/" + convId,
        Map.of("type","AI_TOOL_CALL","toolName",toolName,"inputSummary",inputSummary,"senderId",AI_BOT_USER_ID)
    );
    ```
  - Add case `AI_STREAM_DONE` update: parse optional `toolTrace` array from payload, include it in the final STOMP broadcast
- **Test:** `AiResponseListenerTest.java` — add test for `AI_TOOL_CALL` event forwards correctly.

### TASK AI-4.7 — Flutter: tool call indicators + trace panel `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/domain/chat_state.dart`
  - Add to `MessageModel`:
    - `final List<ToolTraceEntry>? toolTrace` (nullable)
    - `final List<String> activeTools` (tools currently executing, default `[]`)
  - New class `ToolTraceEntry { final String toolName; final String inputSummary; final String resultSummary; }`
- **File:** `apps/client/lib/features/chat/domain/chat_provider.dart`
  - In `_onAiStreamEvent`: add case `AI_TOOL_CALL` → find streaming placeholder, add `toolName` to `activeTools`
  - On `AI_STREAM_DONE`: set `toolTrace` from payload, clear `activeTools`
- **File:** `apps/client/lib/features/chat/ui/widgets/streaming_ai_bubble.dart`
  - If `message.activeTools.isNotEmpty`: show tool indicator row above the thinking dots:
    - `Icons.construction` (small, amber) + text `l10n.aiToolCalling(toolDisplayName)` (e.g. "Searching messages...")
    - Map tool names to display strings: `search_messages → l10n.toolSearchMessages`, `create_reminder → l10n.toolCreateReminder`, etc.
- **New file:** `apps/client/lib/features/chat/ui/widgets/tool_trace_panel.dart` (≤ 150 lines)
  - `ToolTracePanel(List<ToolTraceEntry> trace)` — `ExpansionTile` with `Icons.account_tree` + `l10n.aiToolTrace`
  - Each entry: tool icon (per name) + `toolName` bold + `inputSummary` grey small text
  - Shown only when `message.toolTrace != null && message.toolTrace!.isNotEmpty`
- **File:** `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
  - For AI messages (non-streaming): if `toolTrace != null` → render `ToolTracePanel` below the markdown content

### TASK AI-4.8 — Reminders REST API (chat-service) + Flutter reminder list `DONE`
#### SPEC
Since MongoDB is shared, chat-service reads reminders written by ai-service.
- **New file:** `apps/server/chat-service/.../model/Reminder.java`
  - `@Document(collection = "reminders")`, fields matching ai-service schema: `id, userId, conversationId, text, remindAt (Instant), done (boolean), createdAt (Instant)`
- **New file:** `...repository/ReminderRepository.java`
  - `List<Reminder> findByUserIdAndDoneFalseOrderByRemindAtAsc(String userId)`
  - `Optional<Reminder> findByIdAndUserId(String id, String userId)` (ownership guard)
- **New file:** `...controller/ReminderController.java`
  - `GET /api/reminders` → `List<ReminderResponse>` for authenticated user, only `done=false`, sorted soonest-first
  - `PATCH /api/reminders/{id}/done` → mark done, return 200
  - `DELETE /api/reminders/{id}` → delete (ownership check), return 204
- **New file:** `apps/client/lib/features/reminders/` — `reminder_model.dart`, `reminder_repository.dart`, `reminder_provider.dart`, `reminders_screen.dart` (≤ 400 lines)
  - Screen: list of pending reminders, each showing text + `remindAt` formatted datetime + "Done" swipe action
  - Empty state: `Icons.alarm_off` + `l10n.remindersEmpty`
- **New route:** `/reminders` in `app_router.dart`
- **Access point:** Settings screen → `l10n.reminders` list tile → `/reminders`
- **i18n:** `"reminders"`, `"remindersEmpty"`, `"reminderDone"` to all 7 ARB files

### TASK AI-4.9 — i18n + Tests + Verification `DONE`
#### SPEC
- All new i18n keys to all 7 ARB files: `"aiToolCalling"` (with `{toolName}` placeholder), `"aiToolTrace"`, `"toolSearchMessages"`, `"toolGetUserInfo"`, `"toolSearchKnowledgeBase"`, `"toolSummarizeConversation"`, `"toolCreateReminder"`, `"reminders"`, `"remindersEmpty"`, `"reminderDone"`
- Run `flutter gen-l10n`
- **ai-service tests** (`pnpm test`):
  - `tool-registry.service.spec.ts` — unknown tool returns error string, known tool dispatches correctly
  - `search-messages.tool.spec.ts` — mock Mongoose, test regex search + role mapping
  - `create-reminder.tool.spec.ts` — past date returns error string, future date saves + returns confirmation
  - `ai.service.spec.ts` — extend: agentic loop with 2 tool calls, MAX_ITER guard
- **chat-service tests** (`mvn test`): `AiResponseListenerTest` updated + existing tests pass
- **Flutter** (`flutter analyze && flutter test`): 0 new issues
- **Manual smoke test checklist:**
  - [ ] Ask `@AI what did I say about Flutter?` → sees "Searching messages..." → answer cites found message
  - [ ] Ask `@AI remind me to review code at 5pm tomorrow` → reminder created → appears in `/reminders`
  - [ ] Ask `@AI what do you know about me?` → `get_user_info` tool called → AI answers with profile data
  - [ ] Ask `@AI what does the uploaded doc say about X?` → `search_knowledge_base` tool used → cited answer
  - [ ] Tool trace panel visible below final AI message, collapsible
- **Append to QA LOG** in TODO.md and mark each task DONE

---

## 🧪 QA LOG

### [2026-06-06] SPRINT AI-4 (TASKS AI-4.1 – AI-4.9) → ✅ DONE

- **AI-4.1 — Tool framework (ToolRegistryService + ToolsModule):**
  - `src/tools/tool.interface.ts`: `ToolDefinition` and `ToolContext` interfaces.
  - `src/tools/tool-registry.service.ts`: dispatcher pattern — `getDefinitions()` (5 tools), `execute()` catches all errors and returns plain strings (never throws).
  - `src/tools/tools.module.ts`: imports `KbModule`, `MemoryModule`, `MongooseModule.forFeature([Reminder])`; exports `ToolRegistryService`.
  - `src/app.module.ts` + `src/ai/ai.module.ts`: `ToolsModule` imported.

- **AI-4.2 — `search_messages` + `get_user_info` tools:**
  - `search-messages.tool.ts`: queries `messages` collection with case-insensitive regex; resolves `senderDisplayName` from `users` via `{ _id: { $in: senderIds } } as any` (ObjectId type workaround); limit capped at 10.
  - `get-user-info.tool.ts`: queries `users` collection by `ctx.userId`; returns JSON of non-null fields.

- **AI-4.3 — `search_knowledge_base` + `summarize_conversation` tools:**
  - `search-knowledge-base.tool.ts`: injects `EmbeddingService` + `VectorStoreService`; searches Qdrant `'knowledge'` collection; returns formatted result strings.
  - `summarize-conversation.tool.ts`: injects `MemoryService`; returns summary + key facts or "No conversation summary available yet".

- **AI-4.4 — `create_reminder` tool + `reminders` collection:**
  - `src/tools/reminder.schema.ts`: Mongoose schema `{ userId, conversationId, text, remindAt, done, createdAt }` with `@Schema({ collection: 'reminders' })`.
  - `src/tools/create-reminder.tool.ts`: validates `remindAt` is a future ISO date (returns error string for past/invalid); saves `Reminder` to MongoDB; returns confirmation string.

- **AI-4.5 — Agentic loop (AiService complete rewrite):**
  - `_agenticLoop()` replaces `_streamWithModel()`.
  - Non-streaming `messages.create()` detects `tool_use` stop reason; streaming `messages.stream()` only for final text output.
  - `MAX_ITER = 5` hard limit — if exhausted, publishes `AI_STREAM_DONE` with fallback message.
  - Each tool call publishes `AI_TOOL_CALL` Redis event; builds `toolTrace[{toolName, inputSummary, resultSummary}]`.
  - `AI_STREAM_DONE` payload extended with `toolTrace` field.
  - `ToolRegistryService` injected as 7th constructor parameter.

- **AI-4.6 — `AI_TOOL_CALL` forwarding (chat-service):**
  - `AiResponseListener.java`: new `AI_TOOL_CALL` case broadcasts `{type, toolName, inputSummary, senderId, conversationId}` via STOMP.
  - `AI_STREAM_DONE` case: uses `HashMap` (not `Map.of`) to allow null `toolTrace`; parses and includes `toolTrace` in STOMP broadcast.

- **AI-4.7 — Flutter tool call indicators + tool trace panel:**
  - `chat_state.dart`: `ToolTraceEntry` class + `List<ToolTraceEntry>? toolTrace` + `List<String> activeTools` on `MessageModel`.
  - `chat_provider.dart`: `AI_TOOL_CALL` appends to `activeTools`; `AI_STREAM_DONE` sets `toolTrace` and clears `activeTools`.
  - `streaming_ai_bubble.dart`: `_ToolIndicatorRow` shows amber `Icons.construction` + localized tool name above thinking dots.
  - New `tool_trace_panel.dart` (≤150 lines): `ExpansionTile` collapsed by default, shows `_TraceEntry` per tool call.
  - `message_bubble.dart`: finalized AI bubble wrapped in `Column` with conditional `ToolTracePanel`.

- **AI-4.8 — Reminders REST API (chat-service) + Flutter reminders screen:**
  - `model/Reminder.java`, `repository/ReminderRepository.java`, `dto/ReminderResponse.java`, `controller/ReminderController.java`: `GET /api/reminders`, `PATCH /{id}/done`, `DELETE /{id}`.
  - Flutter: `features/reminders/reminder_model.dart`, `reminder_repository.dart`, `reminder_provider.dart` (`RemindersNotifier` AsyncNotifier with optimistic state removal), `reminders_screen.dart`.
  - Route `/reminders` added to `app_router.dart`; Reminders tile added to `settings_screen.dart`.

- **AI-4.9 — i18n + Tests:**
  - 10 i18n keys added to all 7 ARB files: `aiToolCalling` (with `{toolName}` placeholder), `aiToolTrace`, `toolSearchMessages`, `toolGetUserInfo`, `toolSearchKnowledgeBase`, `toolSummarizeConversation`, `toolCreateReminder`, `reminders`, `remindersEmpty`, `reminderDone`. `flutter gen-l10n` regenerated.
  - New test files: `tool-registry.service.spec.ts` (5 tests), `create-reminder.tool.spec.ts` (3 tests), `search-messages.tool.spec.ts` (3 tests).
  - `ai.service.spec.ts` fully rewritten: 37 tests — 4 new agentic loop tests (single tool, two consecutive tools, MAX_ITER exhausted, tool error → loop continues).
  - `AiResponseListenerTest.java`: new `AI_TOOL_CALL` test added → 5 tests total.
  - `chat_provider.dart:283` `use_build_context_synchronously` lint fixed (`if (!context.mounted) return`).

- **Tests:**
  - `mvn test` (chat-service) → **BUILD SUCCESS, 79/79** (7 suites; AiResponseListenerTest now 5 tests).
  - `pnpm test` (ai-service) → **48/48 pass** (8 test suites: 5 existing + 3 new tool specs).
  - `flutter analyze` → **No issues found** (0 warnings after mounted fix).
  - `flutter test` → **All tests passed**.

- **Files created (ai-service):** `src/tools/tool.interface.ts`, `src/tools/search-messages.tool.ts`, `src/tools/get-user-info.tool.ts`, `src/tools/search-knowledge-base.tool.ts`, `src/tools/summarize-conversation.tool.ts`, `src/tools/reminder.schema.ts`, `src/tools/create-reminder.tool.ts`, `src/tools/tool-registry.service.ts`, `src/tools/tools.module.ts`, `src/tools/tool-registry.service.spec.ts`, `src/tools/create-reminder.tool.spec.ts`, `src/tools/search-messages.tool.spec.ts`.
- **Files modified (ai-service):** `src/ai/ai.service.ts` (complete rewrite), `src/ai/ai.service.spec.ts` (complete rewrite), `src/ai/ai.module.ts`, `src/app.module.ts`.
- **Files created (chat-service):** `model/Reminder.java`, `repository/ReminderRepository.java`, `dto/ReminderResponse.java`, `controller/ReminderController.java`.
- **Files modified (chat-service):** `service/AiResponseListener.java`.
- **Files created (Flutter):** `features/reminders/reminder_model.dart`, `features/reminders/reminder_repository.dart`, `features/reminders/reminder_provider.dart`, `features/reminders/reminders_screen.dart`, `ui/widgets/tool_trace_panel.dart`.
- **Files modified (Flutter):** `domain/chat_state.dart`, `domain/chat_provider.dart`, `ui/widgets/streaming_ai_bubble.dart`, `ui/widgets/message_bubble.dart`, `core/router/app_router.dart`, `features/settings/ui/settings_screen.dart`, all 7 `l10n/app_*.arb`.

---


---

## 🟢 SPRINT AI-5 — Agent Trace & Transparency — DONE

> **Goal:** User sees exactly what AI did — extended thinking blocks, tool calls sequence, token usage, processing time. Token usage dashboard per user. Fully transparent AI.
> **New feature:** Claude extended thinking (`thinking: { type: 'enabled' }`) — captures internal reasoning blocks
> **New MongoDB collection:** `token_usage` (aggregated per user per day)
> **New Message field:** `trace` — persisted alongside AI message content
> **Reference:** `.claude/rules/ai-service.md`, `docs/roadmap.md` (Sprint AI-5)

---

### PHASE 1 — Capture Trace Data (ai-service)

### TASK AI-5.1 — Extended thinking + trace capture `DONE`
#### SPEC
- **File:** `apps/server/ai-service/src/config/configuration.ts`
  - Add: `ai: { enableThinking: process.env.AI_ENABLE_THINKING === 'true', thinkingBudgetTokens: parseInt(process.env.AI_THINKING_BUDGET ?? '8000') }`
- **File:** `infra/docker-compose/compose.yml` — add to ai-service environment:
  - `AI_ENABLE_THINKING: ${AI_ENABLE_THINKING:-false}`
  - `AI_THINKING_BUDGET: ${AI_THINKING_BUDGET:-8000}`
- **File:** `apps/server/ai-service/.env.example` — add both vars
- **File:** `apps/server/ai-service/src/ai/ai.service.ts`
  - Track `const startMs = Date.now()` at the start of `handleRequest()`
  - In the agentic loop's `messages.create()` calls AND the final `messages.stream()` call:
    - If `config.ai.enableThinking`: add `thinking: { type: 'enabled', budget_tokens: config.ai.thinkingBudgetTokens }` to request params. Model must be `claude-sonnet-4-5` or later — thinking is not supported on haiku fallback, skip it silently.
    - NOTE: extended thinking requires `max_tokens >= budget_tokens + 1000`. Increase `max_tokens` to `config.ai.thinkingBudgetTokens + 2048` when thinking is enabled.
  - Collect thinking blocks from all agentic loop iterations and the final stream:
    - In `messages.create()` responses: `response.content.filter(b => b.type === 'thinking').map(b => b.thinking)`
    - In `messages.stream()`: listen for `thinking` content blocks via `stream.on('streamEvent', ...)` — accumulate `thinking_delta` text blocks
  - Collect token usage: after the final stream, `(await stream.finalMessage()).usage` → `{ input_tokens, output_tokens, cache_read_input_tokens? }`
  - Sum token usage across ALL iterations (tool call iterations + final stream)
  - Build `trace` object:
    ```typescript
    interface AiTrace {
      thinkingBlocks: string[];          // captured thinking text blocks
      toolCalls: ToolTraceEntry[];       // from AI-4 toolTrace
      inputTokens: number;
      outputTokens: number;
      thinkingTokens: number;            // from usage.cache_read_input_tokens or thinking block length estimate
      processingMs: number;              // Date.now() - startMs
      model: string;                     // which model was actually used
      iterationCount: number;            // how many agentic loop iterations ran
    }
    ```
  - Include `trace` in `AI_STREAM_DONE` payload: `{ type, fullContent, sources, trace }`
  - Remove top-level `toolTrace` from `AI_STREAM_DONE` (it is now inside `trace.toolCalls`) — update chat-service and Flutter accordingly
- **Test:** `ai.service.spec.ts` — mock `messages.create` returning thinking block; verify `trace.thinkingBlocks` populated; verify `trace.processingMs > 0`; verify `trace.inputTokens` is sum across iterations.

### TASK AI-5.2 — Token usage aggregation `DONE`
#### SPEC
- **New file:** `apps/server/ai-service/src/usage/token-usage.schema.ts`
  - Mongoose schema `TokenUsage`: `userId (String, required)`, `date (String, required, format YYYY-MM-DD)`, `inputTokens (Number, default 0)`, `outputTokens (Number, default 0)`, `requestCount (Number, default 0)`, `updatedAt (Date)`
  - Compound unique index: `{ userId: 1, date: 1 }`
- **New file:** `apps/server/ai-service/src/usage/usage.service.ts`
  - `recordUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void>`
    - `const date = new Date().toISOString().slice(0, 10)` (YYYY-MM-DD)
    - `findOneAndUpdate({ userId, date }, { $inc: { inputTokens, outputTokens, requestCount: 1 }, $set: { updatedAt: new Date() } }, { upsert: true })`
- **New file:** `apps/server/ai-service/src/usage/usage.module.ts` — exports `UsageService`
- **Update:** `apps/server/ai-service/src/ai/ai.service.ts` — inject `UsageService`; after building `trace`, call `await usageService.recordUsage(payload.userId, trace.inputTokens, trace.outputTokens)` (fire-and-forget with `.catch(err => this.logger.warn(...))`)
- **Update:** `apps/server/ai-service/src/app.module.ts` — import `UsageModule`

---

### PHASE 2 — Persist Trace (chat-service)

### TASK AI-5.3 — Persist trace to Message + REST endpoint `DONE`
#### SPEC
- **File:** `apps/server/chat-service/.../model/Message.java`
  - Add field: `@Field("trace") private AiTraceData trace` (nullable, only present on `type="ai"` messages)
- **New file:** `...model/AiTraceData.java` — `@Document` NOT needed (embedded subdocument):
  ```java
  public class AiTraceData {
    private List<String> thinkingBlocks;
    private List<ToolCallEntry> toolCalls;
    private int inputTokens;
    private int outputTokens;
    private int processingMs;
    private String model;
    private int iterationCount;
  }
  public class ToolCallEntry {
    private String toolName;
    private String inputSummary;
    private String resultSummary;
  }
  ```
- **File:** `...service/MessageService.java`
  - Update `saveAiMessage(String conversationId, String content)` signature to `saveAiMessage(String conversationId, String content, AiTraceData trace)` — persist `trace` on the `Message` document
- **File:** `...service/AiResponseListener.java`
  - On `AI_STREAM_DONE`: parse `trace` JSON from payload → deserialize to `AiTraceData` via `ObjectMapper` → pass to `messageService.saveAiMessage(convId, fullContent, trace)`
  - Update STOMP broadcast to include `trace` in the final event map
- **New file:** `...dto/AiTraceResponse.java` — mirrors `AiTraceData` fields for API response
- **File:** `...controller/MessageController.java`
  - Add `GET /api/messages/{id}/trace` — fetch `Message` by id (participant check), return `AiTraceResponse` (404 if `trace == null`)
- **Test:** `MessageServiceTest.java` — update `saveAiMessage` tests to pass trace; `AiResponseListenerTest.java` — verify trace parsed and forwarded correctly.

---

### PHASE 3 — Flutter UI

### TASK AI-5.4 — Flutter: receive + store trace in MessageModel `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/domain/chat_state.dart`
  - Add `AiTrace` class: `thinkingBlocks (List<String>)`, `toolCalls (List<ToolCallEntry>)`, `inputTokens (int)`, `outputTokens (int)`, `processingMs (int)`, `model (String)`, `iterationCount (int)`
  - Add `ToolCallEntry` class: `toolName, inputSummary, resultSummary`
  - Add to `MessageModel`: `final AiTrace? trace` (nullable); parse from `AI_STREAM_DONE` payload and from REST message JSON
  - Remove `toolTrace` field (now inside `trace.toolCalls`) — update all references
- **File:** `apps/client/lib/features/chat/domain/chat_provider.dart`
  - On `AI_STREAM_DONE`: parse `trace` from payload → update streaming message with trace data

### TASK AI-5.5 — Flutter: full trace panel widget `DONE`
#### SPEC
- **File:** `apps/client/lib/features/chat/ui/widgets/tool_trace_panel.dart` — **REPLACE** entirely (was minimal in AI-4):
  - `TracePanel(AiTrace trace)` — `ExpansionTile`, collapsed by default, title: `Icons.account_tree` + `l10n.aiTraceTitle`
  - **Section 1 — Thinking** (only if `trace.thinkingBlocks.isNotEmpty`):
    - `ExpansionTile` with `Icons.psychology` + `l10n.aiTraceThinking`
    - Each block: `Container` with monospace `Text`, light purple background, rounded corners, max-height 200 with scroll
  - **Section 2 — Tool Calls** (only if `trace.toolCalls.isNotEmpty`):
    - Vertical list: each entry shows tool icon (per name map) + bold `toolName` + grey `inputSummary` + italic `resultSummary` (truncated 100 chars)
  - **Section 3 — Stats row** (always shown):
    - Chips in a `Wrap`: `🪙 ${inputTokens}in / ${outputTokens}out`, `⚡ ${processingMs}ms`, `🔄 ${iterationCount} step(s)`, `🤖 ${model}`
    - Stats chips: small `Chip` with grey background, 12sp font
- **File:** `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
  - Replace old `ToolTracePanel` call with new `TracePanel(message.trace!)` — show only when `message.trace != null`

### TASK AI-5.6 — Flutter: token usage dashboard `DONE`
#### SPEC
Token usage is read from chat-service via a new passthrough endpoint (chat-service reads `token_usage` collection from shared MongoDB).
- **New file:** `apps/server/chat-service/.../model/TokenUsage.java`
  - `@Document(collection = "token_usage")`, fields: `id, userId, date (String), inputTokens (int), outputTokens (int), requestCount (int)`
- **New file:** `...repository/TokenUsageRepository.java`
  - `List<TokenUsage> findByUserIdAndDateBetweenOrderByDateAsc(String userId, String from, String to)`
- **New file:** `...controller/UsageController.java`
  - `GET /api/usage/tokens?days=30` (default 30) — returns `List<TokenUsageDayResponse>` for authenticated user, last N days
  - `TokenUsageDayResponse { date, inputTokens, outputTokens, requestCount, totalTokens }`
- **New file:** `apps/client/lib/features/settings/ui/token_usage_screen.dart` (≤ 400 lines)
  - `TokenUsageScreen` — `ConsumerWidget`
  - Top summary cards: total tokens this month, total requests, estimated cost (inputTokens × $0.000003 + outputTokens × $0.000015 — claude-sonnet-4-5 pricing)
  - Bar chart: daily token usage for last 30 days using `fl_chart` package (add to pubspec if not present, else use simple `CustomPaint` bar chart)
  - Each bar: stacked input (blue) + output (purple)
  - Days with 0 usage shown as empty bars
- **New route:** `/token-usage` in `app_router.dart`
- **Access point:** Settings screen → new `l10n.tokenUsage` list tile (below Reminders) → `/token-usage`
- **i18n:** `"tokenUsage"`, `"tokenUsageTitle"`, `"tokenUsageThisMonth"`, `"tokenUsageRequests"`, `"tokenUsageEstCost"`, `"tokenUsageDailyChart"`, `"aiTraceTitle"`, `"aiTraceThinking"`, `"aiTraceTools"`, `"aiTraceStats"` — add to all 7 ARB files
- Run `flutter gen-l10n`

### TASK AI-5.7 — i18n + Tests + Verification `DONE`
#### SPEC
- Verify all 10 i18n keys from AI-5.6 in all 7 ARB files
- **ai-service tests** (`pnpm test`):
  - `usage.service.spec.ts` — mock Mongoose, test `recordUsage` upserts correctly, date format YYYY-MM-DD
  - `ai.service.spec.ts` — extend: thinking enabled → thinking blocks captured; token usage summed across iterations
- **chat-service tests** (`mvn test`): `MessageServiceTest` updated `saveAiMessage` signature; `AiResponseListenerTest` trace deserialization; all existing tests pass
- **Flutter** (`flutter analyze && flutter test`): 0 new issues
- **Manual smoke test checklist:**
  - [ ] Enable `AI_ENABLE_THINKING=true` in .env → ask AI complex question → trace panel shows thinking block
  - [ ] Tool call made → trace panel shows tool call section with input/result
  - [ ] Stats row shows correct token count and processing time
  - [ ] `/token-usage` screen shows bar chart with today's usage after sending AI messages
  - [ ] Disable thinking → trace panel shows only tool calls + stats (no thinking section)
- **Append to QA LOG** in TODO.md and mark each task DONE

---

## 🧪 QA LOG — Sprint AI-5 [2026-06-06]

| Suite | Result | Details |
|-------|--------|---------|
| `pnpm build` (ai-service) | ✅ PASS | Fixed `UsageModule` DynamicModule cast (`as unknown as DynamicModule`) |
| `pnpm test` (ai-service) | ✅ PASS | 9 suites, 55 tests — includes new trace/thinking/token-usage tests |
| `mvn test` (chat-service) | ✅ PASS | All existing tests pass; updated `saveAiMessage` callers to 3-arg |
| `flutter analyze` | ✅ PASS | No issues found |
| `flutter test` | ✅ PASS | 1 test passed |
| `flutter gen-l10n` | ✅ PASS | 10 new keys in all 7 ARBs regenerated |

**Key changes:**
- `AI_STREAM_DONE` payload: `toolTrace` → `trace: { thinkingBlocks, toolCalls, inputTokens, outputTokens, thinkingTokens, processingMs, model, iterationCount }`
- New `UsageService` + `TokenUsage` schema (ai-service) — fire-and-forget per request
- New `AiTraceData` embedded in `Message` (chat-service) + `GET /api/messages/{id}/trace`
- New `GET /api/usage/tokens?days=30` (chat-service) — 30-day token aggregation
- Flutter `TracePanel` replaces `ToolTracePanel`; new `TokenUsageScreen` at `/token-usage`

