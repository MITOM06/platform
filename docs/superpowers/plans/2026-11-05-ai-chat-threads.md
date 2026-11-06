# AI Chat Threads (ChatGPT-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Cuộc trò chuyện mới" with the AI creates a separate conversation (own history, title, files), listed in an AI sidebar — like ChatGPT — on web and mobile.

**Architecture:** An AI thread is an ordinary chat-service `direct` conversation between the user and the AI bot; the user may now own many of them. New endpoints create/list/rename threads; the existing `POST /api/conversations` 409 ("open my one AI chat") stays for old app versions. Everything already keyed by conversationId (ai_sessions, KB, search, persona) becomes per-thread for free. Clients get an AI thread sidebar and stop showing AI threads in the main chat list.

**Tech Stack:** Spring Boot 3 (chat-service), NestJS (ai-service), Next.js + TanStack Query (web), Flutter + Riverpod + go_router (mobile).

**Spec:** this plan (decisions D1–D5 below, confirmed with the user 2026-11-05). Flow map: current single-chat flow — `ConversationService.createConversation` 409 at `ConversationService.java:50-75`, `useOpenAiChat` (web), `getOrCreateConversation` (Flutter).

## Decisions (confirm before implementing)

| # | Decision | Default in this plan |
|---|---|---|
| D1 | Where AI threads are listed | **Only in the AI sidebar** (web: left column when on the AI hub or an AI thread; mobile: AI hub screen + drawer from the AI chat). The main chat list hides them; the sidebar's "Trợ lý AI" button opens the AI area. |
| D2 | Thread title | **First user message, trimmed to 60 chars**, set by chat-service on the first message (instant, free). Renamable. No LLM title. |
| D3 | Existing single AI chat | Becomes the **first thread** as is — no migration. Its title stays empty → shown as "Trò chuyện với AI" until renamed. |
| D4 | Files / knowledge base | **Per thread** (as ChatGPT): a file uploaded in one thread is not searched in another. Long-term memory facts (Qdrant, per user) still carry across threads. |
| D5 | Persona | A new thread **copies the persona** of the user's most recently active thread, so the assistant keeps the name/tone the user set. |

## Global Constraints

- Back-compat: `POST /api/conversations {participantId: AI_BOT}` keeps returning the existing (oldest) AI chat via 409; `GET /api/conversations` without the new param returns what it returns today.
- AI bot id `ai-bot-000000000000000000000001` (`AiConstants.AI_BOT_USER_ID`, web `AI_BOT_ID` in `lib/constants.ts`, Flutter `kAiBotUserId`).
- i18n: every new string in all 7 web `messages/*.json` and all 7 Flutter `lib/l10n/app_*.arb`, then `flutter gen-l10n`.
- Web ↔ mobile parity (`.claude/rules/sync.md`); no raw ids/URLs in UI (`.claude/rules/no-raw-system-data-in-ui.md`).
- File size limits: Flutter widgets ≤ 400 lines, web components ≤ 400 lines, services ≤ 500.
- Thread limit: list returns at most 100 threads, newest activity first.

## Review Focus

1. A user with an **existing** AI chat opens the AI area → that chat is listed as a thread and its messages are intact (Task 1 list test + Task 4/6 manual check).
2. **Old mobile app** (not updated) → still opens the one AI chat via the 409 path and still sees it in its list (Task 1: list without `excludeAi` unchanged).
3. Thread A's file is **not** used to answer in thread B (KB is per conversation — Task 1 test asserts new thread is a new conversationId; no KB change needed).
4. Deleting a thread hides it **only for the user** and it never reappears in the AI sidebar (Task 1: list honours `hiddenFor`/deleted state).
5. Sending the first message names the thread, but a **renamed** thread is never overwritten by later messages (Task 1 auto-title test).

---

### Task 1: chat-service — AI thread endpoints, auto-title, list filter

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/AiThreadController.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiThreadService.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/RenameAiThreadRequest.java`
- Modify: `ConversationController.java` (`GET /api/conversations` gains `@RequestParam(defaultValue="false") boolean excludeAi`), `ConversationQueryService.java` (filter), message send path where a message is saved (`MessageService` / the method used by `ChatController` + `MessageController`) to call `aiThreadService.maybeAutoTitle(conversation, content)`.
- Test: `src/test/java/.../service/AiThreadServiceTest.java`, `src/test/java/.../controller/AiThreadControllerTest.java`

**Interfaces:**
- Produces REST (JWT user):
  - `POST /api/ai-threads` → `201 ConversationResponse` (new direct conversation `[me, AI_BOT]`, `status=accepted`, `name=null`, persona copied per D5).
  - `GET /api/ai-threads` → `List<ConversationResponse>` of the caller's AI conversations (participants = me + bot), excluding ones the caller deleted/hid, sorted `lastMessageAt` desc (fallback `createdAt`), max 100.
  - `PATCH /api/ai-threads/{id}` body `{name}` → `ConversationResponse`; 404 when not the caller's AI thread; name trimmed, 1–80 chars else 400 `AI_THREAD_NAME_INVALID`.
  - Delete = existing `DELETE /api/conversations/{id}` (per-user).
  - `GET /api/conversations?excludeAi=true` → same as today minus AI conversations.
- Produces Java: `AiThreadService.maybeAutoTitle(Conversation c, String userText)` — sets `name` to the first 60 chars (whitespace-collapsed, `…` when cut) only when `c` is a direct AI conversation, `name` is blank, and the sender is not the bot; never overwrites.

- [ ] **Step 1: Failing tests** — `AiThreadServiceTest`:
  - `create_makesNewConversationEvenWhenOneExists` (two creates → two distinct ids, both `[me, bot]`, status accepted).
  - `create_copiesPersonaFromMostRecentThread` (persona of latest-active thread copied; none → no persona).
  - `list_returnsOnlyCallersAiThreads_newestFirst_skipsDeleted` (another user's thread, a human DM and a deleted thread are absent).
  - `rename_rejectsBlankAndTooLong_andForeignThread` (400 / 400 / 404).
  - `autoTitle_setsFirst60Chars_once` (`"  Xin chào\n bạn  "` → `"Xin chào bạn"`; 70-char text → 59 chars + `…`; second message leaves it; renamed title kept; group conversation untouched).
  - Controller test: `GET /api/conversations?excludeAi=true` omits the AI chat; without the param it is present.
- [ ] **Step 2:** `mvn -q test -Dtest='AiThread*'` → FAIL (classes missing).
- [ ] **Step 3:** Implement. Reuse `ConversationRepository` queries; `isDirectAiConversation` logic for the "is AI thread" check; persona copy via `AiPersonaRepository` (find by most recent AI thread of the user, save a copy with the new conversationId).
- [ ] **Step 4:** `mvn -q test` → all pass.
- [ ] **Step 5:** Document the endpoints in `docs/api-spec.md`; commit `feat(chat): AI threads — create/list/rename, auto-title, excludeAi list filter`.

### Task 2: ai-service — no daily digest for AI threads

**Files:** Modify `apps/server/ai-service/src/scheduler/daily-digest.cron.ts` (`activeConversations`); Test `daily-digest.cron.spec.ts`.

**Interfaces:** none new.

- [ ] **Step 1: Failing test** `skips conversations whose participants include the AI bot` — messages yesterday in an AI thread and a group → only the group is digested.
- [ ] **Step 2:** `npx jest src/scheduler` → FAIL.
- [ ] **Step 3:** After `distinct('conversationId')`, drop ids whose `conversations` doc has the bot in `participants` (one `find({_id:{$in}}, {participants:1})`).
- [ ] **Step 4:** `npx jest` → all pass; `npx tsc --noEmit`.
- [ ] **Step 5:** Commit `fix(ai): no daily digest for 1-1 AI threads`.

### Task 3: web — data layer

**Files:** Create `apps/web/lib/api/ai-threads.ts`, `apps/web/lib/hooks/use-ai-threads.ts`; Modify `lib/hooks/use-open-ai-chat.ts`, the conversations list query (add `excludeAi: true`), STOMP cache updates for a new/renamed AI conversation; Tests next to them (`*.test.ts`).

**Interfaces:**
- `aiThreadsApi.list(): Promise<Conversation[]>`, `.create(): Promise<Conversation>`, `.rename(id, name): Promise<Conversation>`.
- `useAiThreads()` (query key `['ai-threads']`), `useCreateAiThread()` (creates, inserts at top of `['ai-threads']`, returns the conversation), `useRenameAiThread()`.
- `useOpenAiChat()` → opens the most recent thread (`list()[0]`), or creates one when none.

- [ ] **Step 1:** Failing tests: list/create/rename hit `/api/ai-threads`; `useOpenAiChat` opens newest thread, creates when empty; main list request carries `excludeAi=true`.
- [ ] **Step 2:** `pnpm vitest run lib` → FAIL. **Step 3:** implement. **Step 4:** pass + `tsc`. **Step 5:** commit.

### Task 4: web — AI sidebar UI

**Files:** Create `apps/web/components/ai/AiThreadList.tsx` (+ `AiThreadItem.tsx` if needed); Modify `app/(main)/layout.tsx` (show `AiThreadList` instead of `ConversationList` when the route is `/ai-hub` or the open conversation is an AI thread), `components/chat/ConversationSettingsDrawer.tsx` (remove `AiSessionPanel`), `ConversationHeader.tsx` (AI thread shows its title; "New chat" icon button), delete `components/chat/AiSessionPanel.tsx` + `lib/api/ai-session.ts` if unused; `messages/*.json` (7).

**Interfaces:** consumes Task 3 hooks.

- [ ] **Step 1:** Failing component tests: list renders titles (empty title → "Trò chuyện với AI" key `aiThreads.untitled`), newest first, active one highlighted; "Cuộc trò chuyện mới" creates and navigates to `/conversations/{id}`; rename inline (Enter saves, Esc cancels); delete asks confirm then removes and, if it was open, navigates to the next thread or `/ai-hub`; "Quay lại tin nhắn" link restores the normal list.
- [ ] **Step 2–4:** fail → implement → `pnpm vitest run` + `tsc` + `eslint` pass; mobile width (375px) usable.
- [ ] **Step 5:** commit `feat(web): ChatGPT-style AI threads sidebar`.

### Task 5: Flutter — data layer

**Files:** Create `apps/client/lib/features/ai_hub/data/ai_thread_repository.dart`, `.../domain/ai_threads_provider.dart`; Modify `chat_repository_conversation_ops.dart` (list with `excludeAi=true`), `ai_hub_screen.dart` `startAiChat` (open newest / create), STOMP conversation updates invalidate `aiThreadsProvider`; Tests under `test/features/ai_hub/`.

**Interfaces:** `AiThreadRepository.list()/create()/rename(id, name)`; `aiThreadsProvider` (AsyncNotifier) with `create()`, `rename()`, `delete()`.

- [ ] Steps as Task 3 (`flutter test test/features/ai_hub`, `flutter analyze`).

### Task 6: Flutter — AI threads UI

**Files:** Modify `ai_hub_screen.dart` (thread list + "Cuộc trò chuyện mới" button, empty state), `chat_app_bar.dart` (AI thread: title + "new chat" + "threads" actions opening a drawer/sheet with the list), conversation list (no AI threads), remove `ai_session_panel.dart` usage in `conversation_info_sidebar.dart`; `lib/l10n/app_*.arb` (7) + `flutter gen-l10n`.

- [ ] Widget tests mirroring Task 4 (list, create+navigate, rename, delete+navigate); `flutter test` + `flutter analyze` clean; commit.

### Task 7: Verification

- [ ] Full suites: chat-service `mvn test`, ai-service `npx jest`, web `pnpm vitest run`, Flutter `flutter test`.
- [ ] Merge into `dev`, run locally / Vercel preview: existing AI chat appears as a thread; new thread is empty; a file uploaded in thread A is not cited in thread B; delete/rename; old behaviour of the main list without `excludeAi`.
- [ ] Single PR to `main` after `dev` passes.
