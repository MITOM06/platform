# Bot Factory ↔ PON Bridge — Direction & Handoff

> **Purpose of this file:** orient a fresh AI session so it can continue this work without re-exploring both codebases. Read this top-to-bottom, then open the implementation plan at
> `docs/superpowers/plans/2026-06-24-botfactory-personal-assistant-bridge.md`.
>
> **Last updated:** 2026-06-24 — Plan written, **implementation not started.**

---

## TL;DR

We are connecting two **separate** products by **federation (NOT a code merge)**:

- **PON / platform** (this repo) — self-hosted single-tenant B2B AI platform. Its native `@AI` is the **company bot ("bot tổng")**: lives in company/group conversations, knows company business, RBAC-scoped.
- **Bot Factory** (`~/projects/personal/bot-factory`, a separate repo) — builds **personal 1-1 assistants ("trợ lý riêng")**, currently used live on Telegram.

The integration: make **PON chat-service a new "channel" for a Bot Factory bot, exactly like Telegram is** — so a member can chat 1-1 with their personal assistant inside the PON app. PON calls Bot Factory's existing HTTP API; Bot Factory is never modified.

---

## ⛔ Hard constraints (do not violate)

1. **`~/projects/personal/bot-factory` is READ-ONLY.** It belongs to the user's friend. Read it to understand the contract; **never edit it**. All code changes happen in **this `platform` repo only** (full access granted).
2. **Do not modify `apps/server/auth-service/`** unless explicitly requested (existing project rule).
3. **Do not touch the native `@AI` path** (RabbitMQ `ai.requests` → ai-service → Redis stream). The Bot Factory bot **coexists** with it as an additional, separate bot member.

---

## The two systems (key facts — no re-exploration needed)

### PON chat-service (Spring Boot 3, `apps/server/chat-service`, port 8080)
- Native AI bot is a **sentinel id** `AiConstants.AI_BOT_USER_ID = "ai-bot-000000000000000000000001"` — **not a real Mongo user**; it just sits in `Conversation.participants`.
- `@AI` mention is detected by regex `(?i)@(AI|ponai)\b` in `ChatController.send` (STOMP, `controller/ChatController.java:59-73`) and `MessageController.sendMessage` (REST, `controller/MessageController.java:50-63`), which **async** publish to RabbitMQ; ai-service streams back via Redis `ai:response:{conversationId}`; `AiResponseListener` → `AiMessageService.saveAiMessage()` persists + broadcasts to `/topic/conversation/{id}`.
- `AiMessageService.saveAiMessage(convId, content, trace)` (`service/AiMessageService.java:36-66`) is the template for persisting+broadcasting a bot message.
- `ConversationService.createConversation` (`service/ConversationService.java:78-102`) special-cases the AI bot at **line 90-92** so a 1-1 with it is auto-`ACCEPTED` (no stranger banner).
- Outbound HTTP uses JDK `HttpClient` (pattern in `service/LinkPreviewService.java:28-32`) — no RestTemplate/WebClient.
- Auth: JWT `Bearer` via `security/JwtAuthenticationFilter`; `security/UserPrincipal` carries `userId/role/perms[]/depts[]` and exposes `PERM_<CAP>` authorities for `@PreAuthorize`. `JWT_ACCESS_SECRET` shared across services.
- **No generic "external bot" framework exists today** — that is exactly what Phase 1 adds.

### Bot Factory (separate repo, Next.js, port 3000) — the external service we CALL
- Generic channel-agnostic endpoint: **`POST /api/bots/{factoryBotId}/chat`**
  - Headers: `Content-Type: application/json`, `x-worker-token: <WORKER_TOKEN>`
  - Body: `{ "message": string, "conversationKey"?: string }`
  - Response: `{ "reply": string, "routing": {...}, "skillsUsed": [...], ... }` — we only need `reply`.
  - The endpoint has **no whitelist/addressing** — the caller controls access.
  - Auth is satisfied solely by the `x-worker-token` header (no browser session needed).
- `conversationKey` scopes per-conversation memory. The Telegram worker uses `tg:<chatId>`; **we pass `pon:<conversationId>`** so each PON conversation is its own isolated memory thread.
- A bot is resolved by `factoryBotId` alone — no owner identity needed in the call.

---

## Vision & conceptual split (validated with the user)

| | Company bot (PON native `@AI`) | Personal assistant (Bot Factory) |
|---|---|---|
| Scope | Workspace / whole company | One individual (1-1) |
| Memory | Company KB (Qdrant/Voyage), RBAC | Owner-scope, private per person |
| Lives in | Group / department conversations | 1-1 chat with each member |
| Role | "AI colleague" of the org | "Personal secretary" of each member |

Two different data-access natures → keep them as **separate entities** (the "two islands" model). They do **not** talk to each other in v1. (A future "personal assistant queries the company bot within the user's RBAC" proxy bridge is explicitly deferred — see Phasing P4.)

---

## Chosen architecture (v1)

A **synchronous HTTP bridge inside chat-service**, mirroring how `@AI` dispatches async:

```
Member sends a message in a 1-1 conversation with their assistant bot
  → chat-service: is the other participant a registered external bot owned by the sender?  (registry lookup)
  → if yes, async (CompletableFuture, same pattern as @AI):
       POST {BOTFACTORY_BASE_URL}/api/bots/{factoryBotId}/chat
         x-worker-token: <BOTFACTORY_WORKER_TOKEN>
         { message, conversationKey: "pon:<conversationId>" }
       ← { reply, ... }
  → AiMessageService.saveBotMessage(convId, botUserId, reply)
       → persist (type "ai", senderId = the bot) + broadcast to /topic/conversation/{id}
```

**Why this, not routing through ai-service/RabbitMQ:** Bot Factory is its own brain; routing it through PON's AI queue is wrong and would hit the "ambiguous `ai:response:{convId}` channel for multiple bots" problem. Calling Bot Factory directly and posting via the existing save+broadcast path sidesteps that entirely → effort is **low–medium**.

### Locked decisions
- **Extend chat-service** (not a separate worker process).
- **1-1 conversations only** for v1.
- **Coexist** with native `@AI` (do not replace it).
- **Registry maps `member → factoryBot`** (`external_bots` Mongo collection); v1 seeds one mapping manually. The synthetic chat identity is `botUserId = "extbot:" + factoryBotId`.
- **Personalization model:** one Bot Factory bot per member (own persona/skills/MCP). v1 maps one by hand; auto-provisioning is P4.

---

## Phasing

- **Phase 1 — server-side bridge (THIS PLAN, not started).** Registry + `saveBotMessage` + `BotFactoryClient` + `ExternalBotService` + 1-1 trigger + auto-accept + register/lookup endpoints. All in chat-service. Plan: `docs/superpowers/plans/2026-06-24-botfactory-personal-assistant-bridge.md`.
- **Phase 2 — group `@mention`.** Resolve a bot handle among group participants; honor a `respondMode` (all/mention).
- **Client UI (separate plan).** "Start chat with my assistant" entry + bot identity rendering in `apps/web` AND `apps/client` (Flutter). MUST satisfy `.claude/rules/sync.md` (web↔mobile parity); use the `orchestrate-feature` skill.
- **Phase 4 — hardening & extension.** Move `worker-token` into connector-service token vault; admin UI to manage bots; auto-provision a Bot Factory bot per member; two-side audit (propagate `traceId` into Bot Factory); optional "personal assistant queries company bot within user RBAC" governed proxy (via connector-service, carrying the user's PON JWT).

---

## How to continue (next action for a fresh session)

1. Read this file + `docs/superpowers/plans/2026-06-24-botfactory-personal-assistant-bridge.md`.
2. The plan has 6 TDD tasks, each with full code + failing-test-first + commit steps. Execute via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.
3. Build/test from `apps/server/chat-service` with system `mvn` (no `mvnw` wrapper): `mvn -q -Dtest=<ClassName> test`. Full suite `mvn -q test` needs Docker (Testcontainers MongoDB).
4. New env vars (chat-service): `BOTFACTORY_BASE_URL`, `BOTFACTORY_WORKER_TOKEN` — already wired into `application.yml` by plan Task 2; set them where chat-service env lives.
5. After Phase 1 lands, do the manual end-to-end check at the bottom of the plan, then start the Client UI plan.

## Decisions log
- **2026-06-24** — Federation over merge; chat-as-channel like Telegram; bridge in chat-service; 1-1 only for v1; coexist with `@AI`; bot-factory read-only; plan written.
- **2026-06-24** — **Federation chosen over the native build.** An earlier same-day working doc proposed building per-member assistants *natively* into PON (an `Assistant` entity + Studio + ai-service gateway resolve + group-harvest governance: `specs/2026-06-24-personal-ai-per-member-design.md`). It was never committed and never implemented (no `assistants` collection, no `assistantId` in code, `USE_PERSONAL_ASSISTANT` capability defined-but-unused). **Cancelled and deleted** — Bot Factory federation is the path. ⚠️ Known gap accepted for now: the native design's RBAC-scoped **group-harvest memory** is not achievable via federation (Bot Factory has no PON RBAC/visibility context); revisit natively only if that becomes required.
