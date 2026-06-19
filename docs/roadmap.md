# Roadmap — PON Project

> **Status:** Phase 1 (Chat Core) ✅ DONE — Phase 2 (AI Layer) ✅ DONE
> **Phase 2 completed:** 2026-06-07
> **Phase 3 (2026-06-19 →): Enterprise pivot** — PON is becoming a self-hosted, single-tenant-per-deployment B2B AI-assistant platform with governed MCP connectors and RBAC.
> **Done so far:** P1 MCP Connector Core ✅ · P0 Enterprise Foundation — Part 1 (RBAC backbone) ✅ + Part 2 (enforcement + connector governance) ✅.
> **Next:** admin console (web/Flutter), audit log, Google connectors (P5), department-aware group bot (P6), self-host kit (P7), SSO (P8).
> **The authoritative, up-to-date roadmap + build state lives in [`superpowers/PON-ENTERPRISE-HANDOFF.md`](superpowers/PON-ENTERPRISE-HANDOFF.md).** The milestones below are the original chat/AI phases (historical).

---

## Milestone 0 — Setup ✅ DONE
- Monorepo structure (pnpm)
- Docker infra: MongoDB port 27018 + Redis
- NestJS auth-service complete (JWT, OTP, refresh, brute force)
- CLAUDE.md + AI workflow established

## Milestone 1 — Spring Boot Foundation ✅ DONE
- Spring Boot 3 project (Maven, Spring Initializr)
- `JwtAuthenticationFilter` — validate JWT from auth-service
- SecurityConfig + CORS config + GET /health endpoint
- Dockerfile multi-stage (maven:21 → jre-alpine)

## Milestone 2 — Core Data Layer ✅ DONE
- `Conversation` + `Message` entities (`@Document`) + Repositories
- REST endpoints: conversations CRUD + messages paginated
- MongoDB aggregation for unread count (avoid N+1)
- Atomic `markAsRead` with `$addToSet`

## Milestone 3 — WebSocket (STOMP) ✅ DONE
- Raw WebSocket `/ws` (no SockJS)
- `ChatController` (`@MessageMapping`) — send, typing, read
- `AuthChannelInterceptor` — JWT validate on STOMP CONNECT
- Presence heartbeat: Redis TTL refresh on STOMP frames

## Milestone 4 — Flutter Client ✅ DONE
- Flutter 3.44.0 setup, Neon Dark Theme UI
- Auth features: Login, Register, VerifyOtp, ForgotPassword
- Chat features: ConversationList, Chat, NewConversation screens
- `StompService` — connect/reconnect/subscribe lifecycle
- Typing indicator, Online/offline status, read receipts

## Milestone 5 (Sprints 5–11) ✅ DONE
- User Profile (Bio, Cover Photo, Friend Counts)
- Group Chat logic (BE/FE integration)
- Block User feature
- Active Friends row with presence time
- Friend Requests / Contacts System
- UI improvements (Neon theme fixes)

## Phase 1 Polish (Sprints 12–24) ✅ COMPLETED
*(See `TODO.md` for detailed specs)*
- [x] **Sprint 12 ✅** Edit Message, Generic File Upload, Cursor-based Pagination, Link Preview
- [x] **Sprint 13 ✅** Mention System, Message Search, True Unread Counts
- [x] **Sprint 14 ✅** Public Channels, Pin/Forward Messages, Markdown Render
- [x] **Sprint 15 ✅** Offline Catch-up, Rate Limiting (Redis sliding-window + client SnackBar)
- [x] **Sprint 16 ✅** Shared Media Gallery (3-tab), Reactions Detail Modal (draggable sheet)
- [x] **Sprint 17 ✅** Profile & UX Enhancements — DOB selector, Cover Photo upload, Change Password, Double-Tap Quick Reaction
- [x] **Sprint 18 ✅** Mute/Archive conversations, Mark Read/Unread, Floating Reaction Sheet, Conversation UX
- [x] **Sprint 19 ✅** Edit Profile routing, Delete For Me verified
- [x] **Sprint 20 ✅** In-app Notification Overlay, Archived Chats screen, Responsive Web Layout
- [x] **Sprint 22 ✅** Auth UX (OTP 6-box), Archived → Settings, Chat Info Sidebar
- [x] **Sprint 23 ✅** Branding, Group Calls picker, Nicknames, Privacy (hideInfo), UserProfileDialog
- [x] **Sprint 24 ✅** Voice Messages, Stickers Panel

---

## Phase 2 — AI Layer ✅ DONE

> **Goal:** Embed an AI agent inside the chat app — AI appears as a real member, has memory, has tools, transparent reasoning.

### Sprint AI-1 — Basic Bot Member ✅ DONE
**Deliverable:** User types `@AI` in any conversation → AI replies with token-by-token streaming, renders markdown, fallback on Claude error.
- [x] Phase 1: Infrastructure — ai-service NestJS scaffold, bot user seed, Redis pub/sub wiring
- [x] Phase 2: Core AI logic — detect @AI, call Claude API streaming, forward chunks via STOMP
- [x] Phase 3: Flutter UI — streaming bubble, thinking indicator, AI identity & avatar
- [x] Phase 4: Error handling, fallback model (haiku), i18n, tests

### Sprint AI-2 — Conversation Memory ✅ DONE
**Deliverable:** AI remembers conversation context (short-term) and user profile (long-term summary).
- [x] Short-term: Redis sliding window of 20 messages injected into system prompt
- [x] Long-term: MongoDB stores conversation summary, injected when relevant
- [x] Flutter: "AI remembers you" screen — view and delete memories

### Sprint AI-3 — Knowledge Base (RAG) ✅ DONE
**Deliverable:** Upload documents → AI answers based on content, with source citation.
- Upload PDF/DOCX → chunk → embed → vector store (MongoDB Atlas Vector or pgvector sidecar)
- RAG pipeline: embed question → top-K chunks → inject → generate
- Flutter: Knowledge Base management screen

### Sprint AI-4 — Tool System ✅ DONE
**Deliverable:** AI can take actions — search messages, create reminders, summarize conversations.
- Agentic loop: LLM → tool call → execute → LLM synthesizes → reply
- Tools: `search_messages`, `summarize_conversation`, `create_reminder`, `get_user_info`, `search_knowledge_base`
- Flutter: tool call indicators inline in chat bubble

### Sprint AI-5 — Agent Trace & Transparency ✅ DONE
**Deliverable:** User can see what AI is thinking — expandable trace panel below each AI message.
- Reasoning steps, tool calls, token usage, confidence score, processing time
- Token usage dashboard per workspace

### Sprint AI-6 — Multi-workspace & Persona ✅ DONE
**Deliverable:** Each workspace has its own AI — custom name, avatar, tone, and knowledge base.
- [x] AI-6.1: PersonaModule (NestJS) — `ai_personas` schema, PersonaService with buildSystemPrompt
- [x] AI-6.2: Quota enforcement — isQuotaExceeded() first check in handleRequest(), AI_STREAM_ERROR on breach
- [x] AI-6.3: Persona-aware system prompt — parallel fetch with memory, tone + prefix injection
- [x] AI-6.4: chat-service REST API — GET/PUT/DELETE `/api/conversations/{id}/ai-persona`, admin-only
- [x] AI-6.5: Flutter AiPersonaScreen + provider — form with name/avatar/tone/instructions, admin-only
- [x] AI-6.6: Flutter ChatState persona fields — aiPersonaName, aiPersonaAvatarUrl, quota sentinel bubble
- [x] AI-6.7: i18n — 12 new keys across all 7 ARB files (en/vi/zh/ja/ko/es/fr)

---

## Phase 3 — Production Ready ✅ DONE

> **Goal:** Make the app deployable, observable, and resilient for real users.

### Sprint P3-1 — CI/CD & Cloud Deployment ✅ DONE
- [x] GitHub Actions CI/CD pipeline: lint → test → build → push Docker images to Artifact Registry → deploy
- [x] Cloud deployment: all 3 backend services on Google Cloud Run (`asia-southeast1`)
- [x] Environment management: all secrets via GitHub Secrets, injected at deploy time
- [ ] Custom domain + SSL *(Cloud Run `.run.app` URLs have managed TLS; custom domain mapping pending)*

### Sprint P3-2 — Push Notifications (Real FCM) ✅ DONE
- [x] Firebase Cloud Messaging: FCM token registration via `auth-service`
- [x] Background message handler in Flutter (`flutter_firebase_messaging`)
- [x] Notification tap → deep-link to correct conversation
- [x] Notification preferences per conversation (mute respected)

### Sprint P3-3 — Performance & Observability ✅ DONE
- [x] MongoDB compound indexes for hot query paths (`conversationId+createdAt`, etc.)
- [x] Redis caching for conversation list + user profiles (`ConversationCacheService`, TTL 2m)
- [x] Structured logging: Winston JSON in NestJS; Logback JSON in Spring Boot (prod profile)
- [x] Health endpoints: Spring Actuator + liveness/readiness probes; NestJS `/health`
- [x] Error tracking: Sentry SDK integrated in Flutter, NestJS (auth + ai), and Spring Boot

### Sprint P3-4 — Security Hardening ✅ DONE
- [x] OWASP audit: security headers (HSTS, X-Frame-Options, nosniff), helmet in NestJS
- [x] Rate limiting: Redis sliding-window throttle on messages; `@nestjs/throttler` on auth
- [x] File upload validation: magic bytes check, per-type size caps, virus scan stub

