# TODO — PON PROJECT
> **Updated:** 2026-06-24
> **Status:** Sprints 1–24 (chat core), AI-1…AI-6 (AI layer), Phase 3 (production), enterprise P0–P8, and the AI-enhancement backlog (TASK-01…14) are all **complete**. Full-project QC passed 2026-06-24 (all builds + tests green). Authoritative build state: `docs/superpowers/PON-ENTERPRISE-HANDOFF.md`.
> **Note:** Sprints 1-24 (chat core) and AI-1 to AI-6 (AI layer) are complete. Active work: Phase 3 (Production Ready) and Web Client (Next.js) parity.

---

## 🗄️ SPRINT DB-ARCH — Data-layer hardening `DONE` (2026-06-19, PR #54, branch `feat/db-arch-p0`)
> Correctness-first DB/architecture fixes for a small-group app — no premature scaling infra. Full rationale in `docs/decisions.md` ADR-011.

- [x] **Indexes (anti-collection-scan):** `reminders {userId,done,remindAt}` + `{done,notified,remindAt}`; `friendships {recipientId,status}`; `token_usage {date}`.
- [x] **Reminder delivery (was broken — `remindAt` stored but never fired):** `notified` flag + `ReminderSweepService` (@Scheduled 60s) + `FcmService.sendReminderPush`; config `app.reminder.sweep-interval-ms`.
- [x] **KB collection dedup:** ai-service writes shared `kb_documents` (dropped duplicate `kb_documents_ai_cache`); `$setOnInsert` preserves chat-service's `uploadedAt`.
- [x] **`user_blocks` collection:** replaced unbounded `users.blockedUsers[]` with indexed rows; auth block/unblock/getBlockState + chat `isBlockedBetween` migrated; idempotent migration `pnpm migrate:blocks` (ran clean — no legacy data).
- [x] **Docs:** ADR-011 + this entry + chat-service/CLAUDE.md, packages/database/README.md, api-spec.md.
- **Deliberately deferred (premature for small-group):** `readBy→message_reads`, RabbitMQ STOMP relay, media-service (GridFS→object storage), notification-service, message TTL index. Analysis preserved in ADR-011.
- **Verify:** chat 90/90 (1 Testcontainers test needs Docker), ai 89/89, auth 9/9, `@platform/database` tsc clean.

---

## 📋 PHASE 3 — PRODUCTION READY

### SPRINT P3-1 — CI/CD & Cloud Deployment `DONE except P3-1.4` (relabeled 2026-07-08 QC sweep)
- [x] **Task P3-1.1: GitHub Actions CI/CD Pipeline**
  - Create pipeline running on push to `main`: lint → test → build → push Docker images to Artifact Registry → deploy. **DONE — ci.yml covers auth-service, chat-service, ai-service, web (Next.js), flutter-client. deploy.yml covers all 3 backend services to Cloud Run.**
- [x] **Task P3-1.2: Google Cloud Run Setup**
  - Deploy `auth-service`, `chat-service`, and `ai-service` to Cloud Run. **DONE — all 4 backend services (incl. connector-service) live on Cloud Run via `deploy.yml`; prod URLs in `docs/superpowers/MEMORY.md`.**
- [x] **Task P3-1.3: Production Environment Management**
  - Configure production environment variables and secrets (GCP Secret Manager / GitHub Secrets). **DONE — GitHub Secrets injected by `deploy.yml` (JWT, RabbitMQ vhost, SESSION_SECRET, Firebase admin base64…).**
- [ ] **Task P3-1.4: Domain & SSL Configuration**
  - Set up custom domains with SSL certificate management.

### SPRINT P3-2 — Push Notifications (Real FCM) `DONE`
- [x] **Task P3-2.1: FCM Token Registration** `M`. **DONE — Implemented in auth-service UsersController.addDeviceToken**.
- [x] **Task P3-2.2: Flutter FCM Integration** `L`. **DONE — Implemented in flutter_firebase_messaging and auth_provider**.
- [x] **Task P3-2.3: Deep Linking** `M`. **DONE — Implemented onMessageOpenedApp and getInitialMessage in main.dart**.
- [x] **Task P3-2.4: Mute Support** `S`. **DONE — Implemented in FcmService.java**.

### SPRINT P3-3 — Performance & Observability `DONE`
- [x] **Task P3-3.1: MongoDB Indexes Audit**
  - Add compound indexes for hot query paths (e.g. `conversationId` + `createdAt`). **DONE — @CompoundIndex on Message (conv+createdAt, conv+type+createdAt, conv+sender) and Conversation (participants+lastMessageAt, publicChannel+lastMessageAt). @Indexed on participants field.**
- [x] **Task P3-3.2: Redis Caching**
  - Cache conversation lists and user profiles in Redis to minimize database load. **DONE — `ConversationCacheService` wraps repository with `@Cacheable("conversation")` (TTL 2m) and `@CachePut` on save; `CacheConfig` sets up `RedisCacheManager` with `GenericJackson2JsonRedisSerializer` and per-cache TTLs. All `ConversationService` findById/save calls go through the cache.**
- [x] **Task P3-3.3: Structured Logging**
  - Use Winston in NestJS services and Logback JSON in Spring Boot for queryable logs. **DONE — JsonLogger (extends ConsoleLogger, emits JSON in production) added to auth-service + ai-service main.ts. logstash-logback-encoder added to chat-service pom.xml + logback-spring.xml (JSON in prod profile, coloured in dev).**
- [x] **Task P3-3.4: Health & Uptime Monitoring**
  - Integrate `/health` endpoints and configure monitoring tools. **DONE — auth-service /health enhanced with uptime field. ai-service /health module added (same pattern). chat-service Spring Boot Actuator already configured; updated application.yml to expose /actuator/health with show-details:always + liveness/readiness probes.**
- [x] **Task P3-3.5: Error Tracking (Sentry)**
  - Integrate Sentry SDK into Flutter, NestJS services, and Spring Boot. **DONE — Spring Boot: `sentry-spring-boot-starter-jakarta:7.6.0` + `SENTRY_DSN` env in application.yml. NestJS auth-service + ai-service: `@sentry/node` + `Sentry.init()` in main.ts, disabled when DSN empty. Flutter: `sentry_flutter:^8.3.0` added to pubspec; `main.dart` wrapped with `SentryFlutter.init()` using `SENTRY_DSN` compile-time env. All services: DSN optional (no-op when empty).**

### SPRINT P3-4 — Security Hardening `DONE`
- [x] **Task P3-4.1: OWASP Security Audit**
  - Audit against NoSQL injection, XSS, CSRF, and implement security headers. **DONE — Spring Boot `SecurityConfig`: added `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS` (1y + preload), `Referrer-Policy: strict-origin-when-cross-origin`. NoSQL injection: Spring Data MongoDB typed criteria are injection-safe; CSRF: correctly disabled (JWT stateless API). NestJS auth-service + ai-service: `helmet` middleware added (excluding CSP + COEP for API compatibility).**
- [x] **Task P3-4.2: Rate Limiting Audit**
  - Audit and apply rate limiting to all REST endpoints and WebSockets inbound channel. **DONE — Spring Boot: `RateLimiterService` extended with `checkUploadRate()` (20/min) and `checkReactionRate()` (30/min); `UploadController` now calls upload rate limiter. NestJS auth-service: `@nestjs/throttler` added with global `ThrottlerGuard` (5 req/s burst + 100 req/min per IP). Existing STOMP message rate (10/5s) unchanged.**
- [x] **Task P3-4.3: Secure File Uploads**
  - Validate uploads via magic bytes check, size caps, and virus scanning stubs. **DONE — `FileValidationService` (magic-bytes check for images/video/audio/PDF/zip/Office/archive + per-type size caps: 10MB image, 100MB video, 20MB audio/doc) + `VirusScanService` interface + `NoOpVirusScanService` stub wired into `UploadController`. All 87 existing tests pass.**

---

## 🖥️ NEXT.JS WEB CLIENT

### SPRINT W-2 — Auth UI `COMPLETED`
- [x] **Task W-2.1: Login Page**
  - Implement email/password form with shadcn UI and Zod validation.
- [x] **Task W-2.2: Registration Page**
  - Form fields for email, password, and display name.
- [x] **Task W-2.3: Verify OTP Page**
  - 6-digit OTP input with resend timer.
- [x] **Task W-2.4: Cookie-based Auth Handlers**
  - Next.js route handlers `set-cookie` and `clear-cookie` for httpOnly refresh tokens.
- [x] **Task W-2.5: Logout & Error UI**
  - Invalidate session, clear cookies, and show error notifications via shadcn `useToast`.

### SPRINT W-3 — Chat Core `COMPLETED`
- [x] **Task W-3.1: Sidebar & Layout**
  - Build responsive split layout (conversation list sidebar + message thread main area).
- [x] **Task W-3.2: Fetching Conversations & Messages**
  - Use TanStack Query to fetch conversations and paginated message history.
- [x] **Task W-3.3: STOMP Client Integration**
  - Subscribe to `/topic/conversation/{id}` for real-time messages and `/topic/conversation/{id}/typing`.
- [x] **Task W-3.4: Message Send & Optimistic UI**
  - Publish to `/app/chat.send` and dynamically append to message cache.
- [x] **Task W-3.5: Read Receipts**
  - Mark messages as read via `PUT /api/messages/{id}/read` when conversation opens.

### SPRINT W-4 — Features `COMPLETED`
- [x] **Task W-4.1: Search & New Conversation**
  - Search users via `GET /api/users/search?q=` and initiate chats.
- [x] **Task W-4.2: Typing Indicators & Online Status**
  - Show real-time typing indicators and online dot.
- [x] **Task W-4.3: Global Notifications**
  - Subscribe to `/user/queue/notifications` and trigger browser notifications.
- [x] **Task W-4.4: AI Bot Integration**
  - Render AI badge and support streaming AI message bubbles.
- [x] **Task W-4.5: Profile Settings & Infinite Scroll**
  - Infinite scroll for historical messages and profile display name/avatar updates.

### SPRINT W-5 — Polish & Deploy `COMPLETED`
- [x] **Task W-5.1: Responsive Breakpoints**
  - Support mobile sizes by hiding sidebar and showing back buttons.
- [x] **Task W-5.2: Theme Support**
  - Toggle between dark/light theme (next-themes).
- [x] **Task W-5.3: Production Build & Vercel**
  - `pnpm build` passes clean. Deploy to Vercel pending (env vars must be set in dashboard).

### SPRINT W-6 — Advanced Message Features (Backend parity) `COMPLETED`
- [x] **Task W-6.1: Message Actions Menu**
  - Hover action menu on message bubbles: Edit, Recall, Forward, React (quick emoji + picker), Pin, Delete for me.
- [x] **Task W-6.2: Edit & Recall Messages**
  - `PUT /api/messages/{id}` (edit with banner in MessageInput) + `DELETE /api/messages/{id}`. Handles STOMP `MESSAGE_UPDATED` / `MESSAGE_RECALLED`.
- [x] **Task W-6.3: Emoji Reactions**
  - Popover emoji picker. `POST/DELETE /api/messages/{id}/reactions`. Handles `REACTION_UPDATED` WS events and renders grouped reaction badges.
- [x] **Task W-6.4: Pin & Unpin Messages**
  - `POST/DELETE /api/messages/{id}/pin`. PinnedMessagesBar in ConversationHeader. Handles `PINNED_MESSAGE` WS event.
- [x] **Task W-6.5: AI RAG Trace Modal**
  - `GET /api/messages/{id}/trace` via AiTraceModal with collapsible sections for thinking/tools/RAG sources.
- [x] **Task W-6.6: Message Forwarding & Search**
  - ForwardMessageModal + `POST /api/messages/{id}/forward`. MessageSearchPanel (`GET /api/messages/search`) accessible via header search button.

### SPRINT W-7 — Group, Channel & Settings Management `COMPLETED`
- [x] **Task W-7.1: Group Chat Creation & Management**
  - NewConversationModal extended with group tab (multi-member select, name field). GroupSettingsDrawer for name edit + add/remove members (admin-only).
- [x] **Task W-7.2: Public Channels**
  - PublicChannelsModal: `GET /api/conversations/public` with search. Join via `POST /api/conversations/{id}/join`. Accessible via Hash icon in sidebar.
- [x] **Task W-7.3: Conversation Settings Menu**
  - ConversationSettingsDrawer: mute/unmute, archive/unarchive, clear history, delete conversation.
- [x] **Task W-7.4: Disappearing Messages (Auto-Delete)**
  - Slider in ConversationSettingsDrawer: Off / 1h / 1d / 1w / 1m → `PUT /api/conversations/{id}/settings`.
- [x] **Task W-7.5: Shared Media & File Gallery**
  - SharedMediaGallery dialog with tabs (media/file/link) → `GET /api/conversations/{id}/attachments`. Accessible via image icon in chat header.

### SPRINT W-8 — FLUTTER PARITY UI REDESIGN `DONE`
- [x] **Task W-8.1: Sidebar Layout & Brand Navigation**
  - Redesign sidebar header to include Pon Logo icon + Linear Gradient text `'PON'`.
  - Add icons in header matching Flutter AppBar: Explore Channels, New DM, Create Group, Contacts, and Profile Settings Avatar.
- [x] **Task W-8.2: Active Online Friends Row**
  - Implement `ActiveFriendsRow` component at the top of the sidebar. Call `GET /api/users/friends/online` to render horizontal online friend avatars with green status dots, and compute last-seen times (e.g., "active now", "10m ago").
- [x] **Task W-8.3: Chat Viewport Backgrounds & Wallpapers**
  - Apply the signature Flutter radial background glows (low-opacity `ponCyan` and `ponPeach` blurred spheres) inside the chat panel.
  - Implement chat wallpaper presets (Sunset, Midnight Glow, Sweet Pink, Neon Teal, Dark Shadow) and custom image background overlays inside the chat window.
- [x] **Task W-8.4: Date Grouping & Separators**
  - Group messages in the chat history by day and render rounded capsule separators ("Today", "Yesterday", or formatted date) with subtle borders.
- [x] **Task W-8.5: Stranger & Block Banners**
  - Render a `StrangerRequestBanner` with "Accept" / "Reject" controls for pending conversations.
  - Render a `BlockedComposerNotice` notice block if the relationship between the users indicates a block.
- [x] **Task W-8.6: Pinned Messages Top Bar**
  - Implement `PinnedMessageBar` below the conversation header. Enable click-to-scroll to jump to the pinned message bubble.
- [x] **Task W-8.7: Message Bubble Redesign & Replies**
  - Style message bubbles with custom rounded corners (`rounded-[24px]` on non-adjacent edges).
  - Implement message replies: display reference previews inside message bubbles, and show a `ReplyComposerBar` above the message input when a reply is active.

---

## 🔴 PHASE 4 — WEB ⇄ FLUTTER REAL PARITY & BUG FIXES
> **Reality check (2026-06-09):** Sprints W-2 … W-8 are marked complete above, but an
> audit against the Flutter client shows the web app still diverges significantly:
> the composer is text-only (no image/file/voice/emoji send), several message types do
> not render, and entire Flutter screens have no web equivalent. This phase tracks the
> *actual* remaining work. Source of truth = `apps/client` (Flutter). Pick tasks by ID.
>
> Size: **S** <30m · **M** ~1h · **L** multi-hour. Status `[ ]` todo `[~]` wip `[x]` done.

### Backend contract (chat-service :8080) — read before any chat task
| Action | Endpoint | Payload / returns |
|--------|----------|-------------------|
| Send | `POST /api/messages` | `{conversationId, content, type, replyToId?}` |
| Upload | `POST /api/uploads` (multipart `file`) | `{url, filename, size}` |
| Link unfurl | `GET /api/utils/link-preview?url=` | `{url,title,description,image,siteName}` |

**Content encoding by `type`:** `image` = URL string OR JSON array `["u1","u2"]` ·
`video` = URL · `file` = JSON `{url,name,size}` · `voice` = URL (m4a) · `sticker` =
emoji char · `text` = plain (detect URL → link preview). Media URLs may be relative →
resolve with `NEXT_PUBLIC_CHAT_URL` (`apps/web/lib/media.ts` → `absoluteMediaUrl`).
Mirror: `apps/client/lib/features/chat/ui/widgets/{image_content,file_content,voice_message_bubble,link_preview_card,message_bubble,chat_input_bar}.dart`.

### SPRINT W-9 — Complete Web Chat `DONE except W-9.12 manual smoke`
- [x] **Task W-9.1: Media helpers + chat API** `S`
  - `lib/media.ts` (absoluteMediaUrl, parseImageUrls, parseFileMeta, formatBytes, firstUrl);
    extend `lib/api/chat.ts` `sendMessage(type, replyToId)` + `uploadFile` + `fetchLinkPreview`;
    add `MessageType` / `UploadResult` / `LinkPreview` types. **(DONE — in working tree.)**
- [x] **Task W-9.2: Image & video render** `M`
  - `components/chat/ImageContent.tsx`: single image, 2/3/4+ collage grid, fullscreen
    lightbox (prev/next/download). Video → thumbnail card with play overlay. **DONE.**
- [x] **Task W-9.3: File attachment render** `S`
  - `components/chat/FileContent.tsx`: ext icon + name + `formatBytes` + download. **DONE.**
- [x] **Task W-9.4: Voice message player** `M`
  - `components/chat/VoiceMessage.tsx`: HTML5 audio play/pause + seek + duration. **DONE.**
- [x] **Task W-9.5: Link preview card** `M`
  - `components/chat/LinkPreviewCard.tsx`: `useQuery(fetchLinkPreview)`, hide if empty;
    detect URL in text via `firstUrl()`. **DONE.**
- [x] **Task W-9.6: MessageBubble render-by-type** `M`
  - Switch on `message.type` → Image/Video/File/Voice/Sticker/text+LinkPreview, keeping
    existing reply-preview, reactions, edit/recall states. **DONE.**
- [x] **Task W-9.7: Reply end-to-end** `M`
  - Reply in `MessageActions`; `replyingTo` state + banner; `replyToId` threaded into
    `sendMessage`; edit restricted to text messages. **DONE.**
    *(Follow-up W-9.B3: reply-preview sender label still "You"/"Other" placeholder.)*
- [x] **Task W-9.8: Composer attachments** `M`
  - `MessageInput.tsx`: attach image/video/document → `uploadFile` → send with correct
    type/content; uploading + error toasts; multi-image → JSON array. **DONE.**
- [x] **Task W-9.9: Composer voice recording** `M`
  - `MessageInput.tsx`: `MediaRecorder` mic UI (timer/cancel/send) → upload → `type:'voice'`;
    disabled gracefully if `mediaDevices` unavailable. **DONE.**
- [x] **Task W-9.10: Emoji picker panel** `S`
  - Composer emoji popover (curated 40-emoji set, no new dep), insert at cursor. **DONE.**
- [x] **Task W-9.11: Typecheck** `S`
  - `npx tsc --noEmit` passes clean (exit 0). Full `next build` not yet run. **DONE.**
- [ ] **Task W-9.12: Manual chat smoke test** `S` *(needs running local backend — pending)*
  - Local backend: text/image/file/voice/reply/reaction/pin/edit/recall/forward/link/
    infinite-scroll/STOMP realtime.

### SPRINT W-10 — Missing Web Screens (parity) `DONE`
- [x] **Task W-10.1: Friends / Contacts** `L` — list, requests, search/add, accept/decline/remove/block (`friends_screen.dart`). **DONE — `app/(main)/friends/page.tsx` and `useFriends` hook.**
- [x] **Task W-10.2: Settings screen** `M` — theme, language, account, logout, sub-screen links (`settings_screen.dart`). **DONE — `app/(main)/settings/page.tsx`.**
- [x] **Task W-10.3: Change password dialog** `S` (`change_password_dialog.dart`). **DONE — `components/chat/ChangePasswordDialog.tsx`.**
- [x] **Task W-10.4: Token usage screen** `M` — AI quota progress + history (`token_usage_screen.dart`). **DONE — `app/(main)/token-usage/page.tsx`.**
- [x] **Task W-10.5: AI Persona settings** `M` (`ai_persona_screen.dart`). **DONE — `app/(main)/ai-persona/page.tsx`.**
- [x] **Task W-10.6: AI Memory screen** `M` (`ai_memory_screen.dart`). **DONE — `app/(main)/ai-memory/page.tsx`.**
- [x] **Task W-10.7: Knowledge Base (RAG) screen** `M` (`kb_screen.dart`). **DONE — `app/(main)/kb/[conversationId]/page.tsx`.**
- [x] **Task W-10.8: Reminders screen** `M` (`reminders_screen.dart`). **DONE — `app/(main)/reminders/page.tsx`.**
- [x] **Task W-10.9: Group info screen** `M` — extend `GroupSettingsDrawer` (`group_info_screen.dart`). **DONE — extended `GroupSettingsDrawer.tsx`.**
- [x] **Task W-10.10: Archived chats** `S` (`archived_chats_screen.dart`). **DONE — `app/(main)/archived/page.tsx`.**
- [x] **Task W-10.11: Explore / public channels** `M` (`explore_screen.dart`). **DONE — `app/(main)/explore/page.tsx`.**
- [x] **Task W-10.12: Shared media gallery** `S` (`explore_media_screen.dart`). **DONE — `app/(main)/shared-media/[conversationId]/page.tsx`.**
- [x] **Task W-10.13: User profile + edit profile** `M` (`user_profile_screen.dart`, `edit_profile_screen.dart`). **DONE — redesigned `app/(main)/profile/page.tsx` with cover, avatar upload, bio.**
- [x] **Task W-10.14: Forgot / reset password** `M` (`forgot_password_screen.dart`, `new_password_screen.dart`). **DONE — `app/(auth)/forgot-password/page.tsx`.**
- [x] **Task W-10.15: Calls (WebRTC)** `L` — defer; largest item (`call_screen.dart`, `webrtc_service.dart`). **DONE — Implemented WebRTC on Web (call-manager.ts, CallOverlay.tsx) and Flutter (webrtc_service.dart, call_screen.dart).**
- [x] **Task W-10.16: Mentions (@) composer + bubble** `M` (`mention_list.dart`). **DONE — integrated into `MessageInput.tsx` and `MessageBubble.tsx`.**

### SPRINT W-11 — Web Polish & Consistency `DONE`
- [x] **Task W-11.1: i18n** — web is hardcoded Vietnamese; Flutter has 7 locales (`L` to adopt). **DONE — adopted `next-intl` 4.x (cookie-based locale, no URL prefix). `i18n/request.ts` + `i18n/config.ts` + `messages/{vi,en,zh,ja,ko,es,fr}.json` (vi=full, en=full, others=English stubs). All 21 pages/components updated to `useTranslations()`. Language switcher added to Settings page (cycles all 7 locales, persists via `locale` cookie + `router.refresh()`). `next build` passes clean.**
- [x] **Task W-11.2: Visual parity pass** — PON neon theme, bubbles, avatars, glow spheres `M`. **DONE — own-bubble neon shadow, active conversation neon left-border, online dot #00E676, sidebar ambient glow spheres.**
- [x] **Task W-11.3: Responsive/mobile audit** `M`. **DONE — h-screen→h-dvh, safe-area-inset-bottom on input, emoji picker max-w-[calc(100vw-1rem)], image button hidden on xs.**
- [x] **Task W-11.4: Typing indicator + pinned-bar render parity** `S`. **DONE — header subtitle shows "typing..." (pon-cyan, animate-pulse) when isTyping; PinnedMessage type mismatch fixed.**
- [x] **Task W-11.5: Active Friends Row** `S` — horizontal list above conversations. **DONE — `ActiveFriendsRow.tsx`.**
- [x] **Task W-11.6: Chat Wallpaper full parity** `S` — support custom HTTP image URLs in `ConversationPage`. **DONE — handled absolute URLs with background cover.**
- [x] **Task W-11.7: Quick Reaction & Stickers** `M` — add quick reaction to `MessageInput` and sticker tab to `EmojiStickerPanel`. **DONE — 👍 quick-send button when input is empty; emoji popover now has Emoji/Stickers tabs; stickers send as `type:'sticker'`.**
- [x] **Task W-11.8: Sync Conversation Settings UI with Flutter** `M` — **DONE — Refactored `ConversationSettingsDrawer.tsx` to use Accordion layout, synced with `conversation_info_sidebar.dart` (Header + Actions + Accordions). Added missing translation keys to all `messages/*.json` files.**

### SPRINT F-1 — Flutter Runtime Debug `IN PROGRESS`
> `flutter analyze` is clean → errors are runtime. Needs a repro (which button throws).
- [ ] **Task F-1.1: Reproduce & log** `M` — run app, click every screen/button, capture stack traces. *(needs running device)*
- [x] **Task F-1.2: Fix navigation errors** `M` — static audit of all `context.go/push` calls vs registered routes: all paths match registered routes; pathParameters always present for named segments. **No issues found.**
- [x] **Task F-1.3: Fix null-safety / cast errors** `M` in tapped handlers. **Static audit complete — all async handlers have `mounted` guards; type casts guarded by `is` checks; `pathParameters[key]!` safe by go_router contract.**
- [ ] **Task F-1.4: Fix API-driven error screens** `M` (4xx/5xx). *(needs running backend)*
- [x] **Task F-1.5: Re-run `flutter analyze` + `flutter test`** `S`. **DONE — `flutter analyze`: no issues (ran 1.4s); `flutter test`: All tests passed.**

### Suggested order
1. W-9.2 → W-9.12 (finish web chat — in progress)
2. W-10.13, W-10.2, W-10.1 (profile, settings, friends)
3. W-10.5 → W-10.8 (AI persona/memory/KB/reminders)
4. F-1.1 → F-1.5 (Flutter debug, once repro available)
5. W-10.14, W-10.9 → W-10.12, W-10.16 (remaining parity)
6. W-11.* polish; W-10.15 calls last

### SPRINT W-12 — Web Chat Logic Bug Fixes `DONE`
> **Audit (2026-06-11):** 3 bugs + 1 missing feature found in web chat after code review.

- [x] **Task W-12.1: REST sendMessage missing STOMP broadcast** `S`
  - `MessageController.sendMessage` (Spring Boot) saves to DB but does **not** broadcast via STOMP. Result: participant B does not receive messages in real time.
  - Fix: add `messagingTemplate.convertAndSend("/topic/conversation/"+convId, response)` after `messageService.sendMessage(...)`.
  - File: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java`

- [x] **Task W-12.2: isOwn alignment bug** `S`
  - When `currentUser` is not yet loaded (null — before `SessionInitializer` completes), all messages render `isOwn=false` (left-aligned). User A's messages appear as user B's.
  - Fix: guard message rendering until `currentUser !== null`.
  - File: `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.3: AI STOMP events falling through to appendMessage** `M`
  - `AI_STREAM_CHUNK`, `AI_STREAM_DONE`, `AI_STREAM_ERROR`, `AI_TOOL_CALL` are not in `STOMP_EVENT_TYPES` → fall through to `appendMessage` → added to cache as junk "messages" (no valid `id` or `content`).
  - Fix: add to `STOMP_EVENT_TYPES`, handle streaming state — accumulate chunks → show streaming bubble → finalize on DONE. `AI_STREAM_ERROR` → toast.
  - File: `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.4: No AI chat entry point on web** `M`
  - No button to create an AI conversation. Users cannot start a chat with AI Assistant from the web client.
  - Fix: add "Chat with AI" button to ConversationList sidebar. Click → `POST /api/conversations { participantId: AI_BOT_ID }` → navigate. In AI conversation, auto-prepend `@AI ` to content before sending.
  - Files: `apps/web/components/chat/ConversationList.tsx`, `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.5: Clear history does not clear cache immediately** `S`
  - `invalidateQueries` triggers stale-while-revalidate → user sees old messages while refetch is in progress.
  - Fix: call `queryClient.removeQueries({ queryKey: ['messages', id], exact: true })` **before** `invalidateQueries` to clear the cache immediately.
  - File: `apps/web/components/chat/ConversationSettingsDrawer.tsx`

### SPRINT W-13 — Bug Fixes (from production audit 2026-06-12) `DONE`
> Source: live testing on https://platform-web-omega-amber.vercel.app after GCP migration.
> Read `apps/web/CLAUDE.md` before starting. All fixes are in `apps/web/`.

- [x] **Task W-13.1: Own messages render on wrong side** `S`
  - Symptom: messages sent by current user appear left-aligned (isOwn=false).
  - Root cause to verify: `msg.senderId` format may differ from `currentUser.id`
    (e.g. MongoDB ObjectId string vs auth-service UUID). Log both in browser console and compare.
  - Fix: normalise comparison or trace where `senderId` is populated on optimistic append.
  - File: `apps/web/app/api/auth/session/route.ts` — normalise `id: data.id || data._id` so `currentUser.id` is always populated even when Mongoose omits the virtual.

- [x] **Task W-13.2: Typing indicator visible to the typer themselves** `S`
  - Symptom: when the current user types, "typing…" appears in their own chat header.
  - Fix: filter `currentUser.id` from `typingUserIds` before passing to `ConversationHeader`.
  - File: `apps/web/app/(main)/conversations/[id]/page.tsx`.

- [x] **Task W-13.3: 409 Conflict when opening AI conversation** `S`
  - Fix: catch 409 in `handleOpenAiChat` → scan `getConversations()` for AI participant → navigate to existing.
  - File: `apps/web/components/chat/ConversationList.tsx`.

- [x] **Task W-13.4: Media/upload URLs resolve to Vercel domain (404)** `S`
  - `.env.production` updated to `lwnzrufcxa` Cloud Run URLs. Included in this commit — Vercel will redeploy automatically.

- [x] **Task W-13.5: Cannot view sender's profile from chat** `M`
  - New file: `apps/web/components/chat/UserProfileDrawer.tsx` — Sheet with avatar, name, bio, online status, Send/Friend/Block buttons.
  - Edit: `apps/web/components/chat/MessageBubble.tsx` — sender label is now a clickable button that opens `UserProfileDrawer`.

### SPRINT W-14 — UX/UI Refinement (Audit 2026-06-12) `DONE`
> **Focus:** Web Client (Next.js) UX improvements. Fix usability flaws identified during QA. Optimize UI for touch devices.

- [x] **Task W-14.1: Prevent Send/Mic button misclicks on mobile** `S`
  - Problem: `Send` and `Voice Record` buttons are too close on small screens.
  - Fix: Conditionally render in `MessageInput.tsx`. If `text.trim().length > 0`, show `Send` and hide `Mic`. Show `Mic` only when input is empty. **DONE — emoji moved to right (W-14.2) makes layout cleaner; existing conditional render confirmed correct.**

- [x] **Task W-14.2: Relocate Emoji Picker** `S`
  - Problem: Emoji picker is on the far left, causing poor ergonomics.
  - Fix: Move the Emoji toggle button to the right side of the text input, adjacent to the `Send` button. **DONE — Emoji popover moved to right side; layout: [Attach][Textarea][Emoji][Send or Mic+👍].**

- [x] **Task W-14.3: Safeguard "Clear History" action** `M`
  - Problem: `Clear History` is visually identical and adjacent to `Block User` in `ConversationSettingsDrawer.tsx`, causing dangerous misclicks.
  - Fix: Add a thick divider between them. Remove `destructive` variant from `Clear History`. Add an `AlertDialog` requiring user to confirm deletion explicitly. **DONE — thick Separator added; Clear History uses neutral styling; Dialog confirmation added (Cancel + Delete buttons).**

- [x] **Task W-14.4: Reply banner overlaps input text** `S`
  - Problem: `ReplyComposerBar` uses `position: absolute`, overlapping multi-line input.
  - Fix: Refactor container to `flex-col` so the reply banner stacks above the input area naturally without overlapping. **DONE — outer container uses `flex flex-col`; reply/edit banners stack naturally above input row.**

- [x] **Task W-14.5: Support Long-press for Message Actions on Touch Devices** `M`
  - Problem: Message hover menus (Edit/Recall/Forward) rely on `onMouseEnter`, making them inaccessible on mobile/touch screens.
  - Fix: Implement long-press events (e.g., via `use-long-press` or custom touch handlers) to open the action menu on mobile. **DONE — 600ms long-press via onTouchStart/onTouchMove/onTouchEnd; triggers haptic vibration (20ms); action menu visible on `hovered || longPressActive`; row click dismisses after 400ms guard.**
  - File: `MessageBubble.tsx`

### SPRINT D-1 — Deep Debugging & Parity Sync (Audit 2026-06-12) `DONE`
> **Focus:** Full-stack deep debugging. Resolve Flutter UI overflow, broken Web AI integration, and Web ⇄ Flutter feature parity issues. Follow `PROMPT_DEBUG_FULLSTACK.md` methodology.

- [x] **Task D-1.1: Fix Flutter UI Overflow (Yellow Stripes)** `M`
  - Problem: Flutter mobile app displays "BOTTOM OVERFLOWED BY 131 PIXELS" in the modal bottom sheet (actions menu) and "OVERFLOWED BY 6 PIXELS" in the top navigation bar/AppBar next to the "PON" brand text.
  - **DONE** — Bottom sheet (`floating_reaction_sheet.dart`): wrapped the up-to-8 action `ListTile`s in a `Flexible` + `SingleChildScrollView` (`mainAxisSize.min`) so the action list scrolls instead of overflowing on small screens / when the keyboard is up; pull-bar + reactions row stay fixed at top. AppBar (`conversation_list_screen.dart`): title `Row` set to `MainAxisSize.min`, PON `ShaderMask`/`Text` wrapped in `Flexible` with `maxLines:1` + `TextOverflow.ellipsis`, and `titleSpacing:8` to free room for the 5 action buttons. `flutter analyze` clean.
  - Scope: `apps/client`

- [x] **Task D-1.2: Deep Debug Web AI Integration** `L`
  - Problem: AI assistant on the Next.js web client is broken and inaccessible.
  - **DONE** — Full trace of the pipeline: web Bot button → `createConversation(AI_BOT_ID)` → REST `POST /api/messages` (prepends `@AI`) → `MessageController` broadcasts via STOMP **and** publishes `ai:request` (verified present, lines 47-54) → ai-service subscriber (try/catch hardened) → `AiResponseListener` relays `AI_STREAM_CHUNK/DONE/ERROR/TOOL_CALL` with field names (`chunk`/`error`) matching the web handler. CORS/WS: `deploy.yml` sets `ALLOWED_ORIGINS=<vercel>` for chat-service; `WebSocketConfig` reads it. **Bugs fixed:** (1) AI conversations were created with `STATUS_PENDING` (AI bot is not a "friend") → web rendered the AI chat behind a stranger-request banner / restricted composer. `ConversationService.createConversation` now treats `AI_BOT_USER_ID` as always-accepted. (2) Web auto-scroll only depended on `messages.length`, so the streaming AI bubble grew off-screen (felt "broken"); added `aiStreamContent` to the scroll effect deps. chat-service `mvn compile` BUILD SUCCESS; web `pnpm build` clean.
  - Scope: `apps/web`, `apps/server/ai-service`, `apps/server/chat-service`

- [x] **Task D-1.3: Enforce Web ⇄ Flutter UI Parity** `L`
  - Problem: Web features and UI significantly diverge from the Flutter app.
  - **DONE (audit)** — Route-level comparative audit complete. Every non-deferred Flutter route has a web equivalent: screens map 1:1 to pages, and Flutter sub-screens map to web modals/drawers (`/new-conversation`+`/new-group`→`NewConversationModal`, `/group-info`→`GroupSettingsDrawer`, `/user/:id`→`UserProfileDrawer`, `/edit-profile`→merged into `/profile`). Per-conversation screens (`ai-persona`, `kb`, `shared-media`) use `?conversationId=` / route params with graceful empty-state handling. Visual parity (PON cyan/peach/pink, rounded-3xl, glow spheres, neon bubbles) was landed in W-8/W-11. **Only gap = Calls/WebRTC (`/call`), explicitly deferred as W-10.15.** Minor: `/theme-onboarding` (Flutter-only first-run flow, N/A on web).
  - Scope: `apps/web`

### SPRINT D-2 — Critical Fixes & Auth Enhancement (Audit 2026-06-12) `DONE`
> **Focus:** Fix group creation 400 error, improve login/register error handling, sync conversation settings with Flutter, add password strength UI, add Google/Facebook OAuth. Read `CLAUDE.md`, `apps/web/CLAUDE.md`, `PROMPT_DEBUG_FULLSTACK.md` before starting.
>
> **CRITICAL:** After every task, run `pnpm build` (web) and/or `mvn compile` (chat-service) and/or `flutter analyze` (client). Fix all errors before moving on.

- [x] **Task D-2.1: Fix group creation 400 (Bad Request)** `S` **DONE — changed `memberIds` → `participantIds` in `createGroup` payload; verified `CreateGroupRequest.java` uses `participantIds`. `pnpm build` clean.**

- [x] **Task D-2.2: Login error — show "wrong password/email" instead of system error** `M` **DONE — catch block now distinguishes 401 (backendMsg ?? invalidCredentials), 404 (emailNotFound), other (systemError). i18n keys added to all 7 web JSON files. Flutter _friendlyError already handled 401. `pnpm build` + `flutter analyze` clean.**

- [x] **Task D-2.3: Register — validate email exists as real Gmail user** `M` **DONE — auth-service `register()` now does `dns.promises.resolveMx(domain)` before creating user; throws 400 "Email domain does not exist". Web register page catches domain 400 → shows `emailDomainInvalid`. Flutter _friendlyError catches "domain" string. i18n keys added to all 7 ARB + web JSON files. `pnpm build` (auth) + `pnpm build` (web) + `flutter analyze` all clean.**

- [x] **Task D-2.4: Register — password strength meter UI** `M` **DONE — Web: Zod schema now requires uppercase+lowercase+digit+special+min8; `PasswordStrengthMeter` component (4-bar + checklist) created at `components/auth/PasswordStrengthMeter.tsx`. Flutter: validator updated to min8+uppercase+lowercase+digit+special; `PasswordStrengthIndicator` widget created at `features/auth/ui/widgets/password_strength_indicator.dart`. i18n keys added to all 7 ARB + web JSON files. `pnpm build` + `flutter analyze` clean.**

- [x] **Task D-2.5: Conversation Settings — sync Web with Flutter** `L` **DONE — ConversationSettingsDrawer rewritten with Flutter-parity order: Mark read/unread → Mute → View profile/Group info → Voice call (disabled) → Video call (disabled) → Block/Unblock → Archive → Auto-delete → Wallpaper → Clear history → Delete. Added `markConversationUnread`, `blockUser`, `unblockUser` to `chat.ts`. ConversationHeader passes `onOpenProfile`/`onOpenGroupInfo` callbacks. i18n keys added to all 7 web JSON files. `pnpm build` clean.**

- [x] **Task D-2.6: Google & Facebook OAuth Login** `L` **DONE — Backend already had GoogleStrategy + FacebookStrategy + `handleSocialLogin` + `POST /auth/exchange`. Web: Google/Facebook buttons added to login/register pages; redirect to `AUTH_URL/auth/social/{provider}/init?platform=web`; new `/oauth-callback` page exchanges code + sets auth. `authService.exchangeCode()` added to auth.ts. Flutter: Google/Facebook buttons added to login/register screens using `url_launcher` (opens external browser for OAuth flow). i18n keys added to all 7 ARB + web JSON files. `pnpm build` (auth) + `pnpm build` (web) + `flutter analyze` all clean. Note: configure `WEB_REDIRECT_URL=https://your-domain/oauth-callback` in auth-service env for web callback to work.**

---

## 🧪 QA LOG

```text
QC Full 2026-07-08 (Sprint QC-4 — full-project sweep + cleanup)
Phase 1: auth build ✓ | ai build ✓ | connector build ✓ | chat compile ✓ | flutter analyze ✓ (0 issues) | web lint+tsc ✓
Phase 2: auth test 53/53 | ai test 325/325 | connector test 101/101 | chat test 136/136 | flutter test 50/50 | web test 70/70
Phase 3: infra ✓ (fixed jaeger image tag 1.62→1.62.0) | auth-svc ✓ (fixed broken start:dev --entryFile) | chat-svc ✓
Phase 4: jwt ✓ (chat 200) | profile ✓ | search ✓ | conversation ✓ | message send+list ✓ | presence ✓
i18n: mobile 956 keys × 7 locales in sync | web 1258 keys × 7 locales in sync
Web↔Mobile sync audit: PASS — message types, STOMP topics, endpoints, 18 feature spot-checks all in parity
Issues fixed: 26 —
  chat-service (7): dup AI persist multi-instance (Redis SETNX claim), reminder dup/poison (atomic claim),
    cursor pagination same-ms skip (compound tiebreaker), Conversation lost-update+stale cache (atomic $set+evict),
    markAsRead/deleteForMe missing participant authz, markConversationUnread race, pagination under-fill
  connector (3): workspace connectors not executable by members (HIGH), OAuth deny → raw 400 JSON, state no-expiry (10m TTL)
  ai-service (2): unfenced MCP tool_result (prompt-injection), pre-tool streamed text dropped from persisted msg
  web (5): STOMP torn down on every token refresh (HIGH), reply-quote raw content leak (P1),
    "system" literal in notif title, conversations refetch storm, meeting_summary/ai raw preview leak (P1)
  mobile (9): mute ignored in foreground (HIGH), token-refresh race → forced logout (HIGH), call duration 00:00,
    reply-quote raw leak (P1), stuck-pending send watchdog+retry, hardcoded EN string, non-locale date,
    unknown system.* leak in conv list, meeting_summary/ai raw preview leak (P1)
Cleanup: deleted org/ .superpowers/sdd/ _workspace_prev/ flutter logs .iml empty apps/web/apps;
  .gitignore pruned dead Go/Expo/RN rules + org/ added; docs refreshed (MEMORY.md facts, plans/README index 44 plans,
  CLAUDE.md bridge merged, TODO sprint labels)
Status: CLEAN — all builds/tests green, smoke test PASS
```

---

### SPRINT W-14 — UI/UX Polish & Feature Completion `DONE`
> Source: live production audit 2026-06-12.
> **MANDATORY before every task**: Read `.claude/rules/sync.md` (cross-platform sync rule).
> Then read `apps/web/CLAUDE.md` + `apps/client/CLAUDE.md`. Mirror Flutter file listed per task.

- [x] **Task W-14.1: Friends screen crash — TypeError reading '0'** `S` **DONE — Root cause: `GET /api/friends/requests` returns `{friendshipId, requester}[]` (not flat users), so `user.displayName[0]` threw. Fixed `friends.ts` `listRequests` to map `.requester` + `?? []` fallbacks on both list calls; added `displayName?.[0] ?? '?'` guard in `page.tsx`. `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/friends/ui/friends_screen.dart`
  - File: `apps/web/app/(main)/friends/page.tsx`, `apps/web/lib/api/friends.ts`

- [x] **Task W-14.2: Duplicate new-conversation buttons in sidebar header** `S` **DONE — Web had 2 new-DM triggers (layout `MessageSquarePlus` + ConversationList `Plus`), 2 explore triggers (layout `Compass` + ConversationList `Hash`), and `ActiveFriendsRow` rendered twice. Mirroring Flutter (AppBar = Explore + Create Group + Contacts + Settings; new-DM = FAB): removed `MessageSquarePlus` from layout header (kept Explore/Group/Contacts/profile); removed duplicate `Hash` + duplicate `ActiveFriendsRow` from ConversationList (kept single `Plus` new-DM + AI Bot). Now exactly 1 new-DM + 1 new-group. `tsc --noEmit` clean.**
  - Mirror: Flutter sidebar header (conversation list app bar).
  - File: `apps/web/components/chat/ConversationList.tsx`, `apps/web/app/(main)/layout.tsx`

- [x] **Task W-14.3: Chat header right side — keep only 3 icons** `S` **DONE — Mirrors Flutter `chat_app_bar.dart` (call + videocam + info-sidebar; search/media live inside sidebar). Removed Search + shared-media (ImageIcon) buttons from `ConversationHeader` header row → now Phone/Video/Settings only. Wired drawer's existing Search quick-button to `onSearch` (was a TODO toast) and Files&Media accordion entries to `onOpenSharedMedia` (were "Coming soon" toasts); both callbacks threaded from header (`onSearchToggle` + `setGalleryOpen`). `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/chat/ui/widgets/chat_app_bar.dart`
  - Files: `apps/web/components/chat/ConversationHeader.tsx`,
           `apps/web/components/chat/ConversationSettingsDrawer.tsx`

- [x] **Task W-14.4: Conversation settings drawer — all actions non-functional** `M` **DONE (audit) — Full audit confirms all listed actions are wired and functional after the D-2.5 drawer rewrite (task was written against the pre-D-2.5 drawer): Mute→`POST /{id}/mute|unmute`, Archive→`/archive|unarchive`, Clear history→`POST /{id}/clear`, Auto-delete→`PUT /{id}/settings {autoDeleteSeconds}` (DTO `AutoDeleteRequest.autoDeleteSeconds` matches), all via `chatApi`. `run()` helper invalidates `['conversations']` + `['conversation', id]` — the exact keys used by `useConversations`/`useConversation`, so toggles refresh. `ConversationResponse` returns per-user `isMuted`/`isArchived`. Wallpaper writes localStorage + dispatches `wallpaper-changed`, which `conversations/[id]/page.tsx` listens for and applies. `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/chat/ui/screens/conversation_settings_screen.dart`
  - File: `apps/web/components/chat/ConversationSettingsDrawer.tsx`

- [x] **Task W-14.5: Wallpaper picker — redesign UX + upload support + system message** `M` **DONE — New `WallpaperPickerModal.tsx` mirrors Flutter `chat_wallpaper_dialog.dart`: live preview + preset circles (Default + Midnight Glow/Neon Teal/Sunset/Sweet Pink/Dark Shadow, exact `preset:<id>` values) + Upload tile (`chatService.uploadFile` → `POST /api/uploads`) + image-fit selector (cover/contain/fill) + Cancel/Confirm. On Confirm: persists to `localStorage`, dispatches `wallpaper-changed`, and sends a `type:'system'` message `system.theme.changed:<value>` (Flutter's exact format, NOT the suggested `sys.wallpaper.changed`, for cross-platform parity). `ConversationSettingsDrawer` customize accordion now has a single "Change Wallpaper" button opening the modal (removed inline grid + old flat-key state). Chat page `resolveWallpaper()` updated to handle Flutter `preset:`/empty/`http...#fit=` formats (backward-compatible with old flat keys). `MessageBubble` humanises `system.theme.changed:` (+ quick_reaction/nickname) instead of showing raw content. i18n keys added to all 7 `messages/*.json` (vi+en full, rest English stubs). `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart`
  - Files: `apps/web/components/chat/ConversationSettingsDrawer.tsx`,
           new `apps/web/components/chat/WallpaperPickerModal.tsx`

- [x] **Task W-14.6: Group member list shows raw IDs instead of display names** `S` **DONE — Added `GroupMemberRow` subcomponent that resolves each `participants[]` userId via the existing `useUser(uid)` hook (`GET /api/users/{id}`, 5-min cached). Renders avatar (resolved `avatarUrl` via `absoluteMediaUrl`) + display name + "Admin" badge (mirrors Flutter `group_info_screen.dart`'s `_MemberTile`) + remove button for admins. Added `groupAdmin` i18n key to all 7 `messages/*.json` (vi="Administrator", rest English stub). `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/chat/ui/group_info_screen.dart`
  - File: `apps/web/components/chat/GroupSettingsDrawer.tsx`

- [x] **Task W-14.7: AI persona avatar — replace URL text input with image upload** `S` **DONE — Removed the "Avatar URL" text input; the avatar preview is now a click-to-upload button (camera/spinner overlay) → `chatService.uploadFile` (`POST /api/uploads`) → stored URL; preview resolves via `absoluteMediaUrl`. Added `avatarUploadLabel`/`avatarUploadError` i18n keys to all 7 `messages/*.json` (vi full, rest English stub). `tsc --noEmit` clean. Note: Flutter `ai_persona_screen.dart` still uses a URL text field — upload-parity there is a follow-up.**
  - Mirror: `apps/client/lib/features/chat/ui/ai_persona_screen.dart`
  - File: `apps/web/app/(main)/ai-persona/page.tsx`

- [x] **Task W-14.8: Conversation nickname for direct chats** `S` **DONE — No backend change needed: Flutter stores nicknames client-side (`shared_preferences chat_nicknames_<convId>`) and syncs via `system.nickname.changed:<userId>:<nickname>` system messages (same pattern as wallpapers). Mirrored exactly on web: new `lib/nicknames.ts` (localStorage map + `NICKNAME_EVENT` + `useNickname` hook + `applyNicknameSystemMessage` parser). ConversationSettingsDrawer customize accordion now has a Nickname input (direct chats only) → saves locally + broadcasts the system message. ConversationHeader DM display name now prefers the nickname. Conversation page parses incoming STOMP + historical `system.nickname.changed:` messages to seed the store (cross-participant/cross-device + Flutter sync). MessageBubble already humanises the system message (W-14.5). i18n keys `nicknamePlaceholder`/`nicknameSuccess` added to all 7 `messages/*.json`. `tsc --noEmit` clean.**
  - Mirror: Flutter `chat_provider.dart` (NicknamesNotifier) + `conversation_customisation_dialogs.dart`
  - Files: `apps/web/components/chat/ConversationSettingsDrawer.tsx`, `apps/web/lib/nicknames.ts`, `apps/web/components/chat/ConversationHeader.tsx`, `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-14.9: Voice call = audio only; Video call = two-way video (Zalo style)** `L` **DONE — Confirmed WebRTC fully wired first (`lib/webrtc/call-manager.ts` single RTCPeerConnection + STOMP signaling, store-driven UI from W-10.15). Added a `video` flag end-to-end: `call.store` (`video` field), `callManager.startCall(...,video)` → `getUserMedia({audio:true, video})`; receiver auto-detects mode from the offer SDP (`m=video`) in `acceptIncoming` + layout incoming handler. Split UI into new `components/call/VoiceCallModal.tsx` (large avatar + animated waveform + hidden `<audio>` for remote, mic+end only — no video) and `components/call/VideoCallModal.tsx` (remote fullscreen + local PiP + mic/camera/end, Zalo style). `CallOverlay` now keeps idle/incoming prompt (labels voice vs video) + duration timer and delegates outgoing/connected to the right modal. ConversationHeader: Phone→`startCall(...,false)`, Video→`startCall(...,true)`. `tsc --noEmit` clean (from apps/web). Note: Flutter mirror is a single `chat/presentation/call_screen.dart` (the listed voice/video screen paths don't exist) — its layout = the web VideoCallModal; the dedicated voice UI is a web-side Zalo-style enhancement.**
  - Mirror: `apps/client/lib/features/chat/presentation/call_screen.dart`
  - Files: new `apps/web/components/call/VoiceCallModal.tsx`,
           new `apps/web/components/call/VideoCallModal.tsx`,
           `apps/web/components/call/CallOverlay.tsx`,
           `apps/web/components/chat/ConversationHeader.tsx` (wire call buttons)

- [x] **Task W-14.10: User profile drawer on avatar / sender name click** `M` **DONE — `UserProfileDrawer.tsx` already exists (W-13.5) with avatar/name/bio/online-status + Send message/Add friend/Block actions, and the MessageBubble sender name already opens it. Closed the remaining gaps: ConversationHeader avatar + display name are now clickable (direct → opens `UserProfileDrawer` for the other user, mirroring Flutter `chat_app_bar.dart`'s tappable avatar → `showUserProfileDialog`; group → opens group info). Also wired the settings drawer's "View profile" action (`onOpenProfile`) which was previously a no-op. `tsc --noEmit` clean.**
  - Mirror: `apps/client/lib/features/chat/ui/widgets/chat_app_bar.dart` + `profile/ui/widgets/user_profile_dialog.dart`
  - Files: `apps/web/components/chat/UserProfileDrawer.tsx` (existing), `apps/web/components/chat/ConversationHeader.tsx`

- [x] **Task W-14.11: Web App Deep Debugging and Bug Fixes** `M` **DONE — 
  - **Group Creation (400 Bad Request):** Fixed the bug where creating a group on web threw a 400 Bad Request by removing the undocumented `publicChannel` property from `chatService.createGroup()` payload.
  - **Login Error Handling:** Fixed `login/page.tsx` error mapping where a `401 Unauthorized` or `400 Bad Request` backend exception (which returns `message: string | string[]`) incorrectly displayed a generic "System error". Now correctly parses arrays and shows the precise authentication failure.
  - **AI Chat Navigation (409 Conflict):** Fixed AI Chat creation to seamlessly redirect using the `body.conversationId` returned by the server on `409 Conflict`, instead of performing a fragile client-side search.
  - **UI Regressions from prior AI:** Restored the `ActiveFriendsRow` and the "Explore Channels" (`Hash`) buttons in `ConversationList.tsx`, and the "New Chat" (`MessageSquarePlus`) button in `layout.tsx` which were incorrectly deleted during earlier sync tasks.
  - **React Warnings:** Fixed an exhaustive-deps `useEffect` warning in `page.tsx` by wrapping the fallback empty array in `useMemo`.

### SPRINT W-15 — Chat UI/UX Refinement & Parity `DONE`
> **Based on AI Codebase Planner & Execution Prompt**

- [x] **Task W-15.1: Chat List Sidebar Preview Logic & System Messages Formatting**
  - **Platform:** Web & Mobile
  - **Message Preview:** In the left sidebar chat list, update the subtitle. For 1-on-1 chats: If the current user sent the last message, display "You: [message]". If the other user sent it, display only "[message]".
  - **System Messages Formatting:** Map backend system events to clean, professional human-readable text (e.g., "User changed the theme", "Group was created") instead of raw system codes/JSON. Apply to sidebar preview and main chat area.

- [x] **Task W-15.2: Chat Background Upload & Interactive Preview Modal**
  - **Platform:** Web & Mobile
  - **Fix:** Fix any current issues preventing chat background images from uploading correctly.
  - **Feature:** Live Preview Modal. When uploading a new background, do not apply immediately. Open a Preview Modal with mockup chat interface and dummy messages over the newly uploaded background. Allow adjust/crop/scale. Apply exact coordinates only on "Submit/Save".

- [x] **Task W-15.3: Quick Reaction (Emoji) Customization Bug**
  - **Platform:** Web
  - **Fix:** In chat settings, the "Quick Reaction" cannot currently be changed to other emojis. Fix state management and API calls so the emoji picker correctly updates the quick reaction icon for the conversation in both UI and DB.

- [x] **Task W-15.4: Nickname Configuration (1-on-1 Chats)**
  - **Platform:** Web
  - **Feature:** Implement nickname editing mimicking Facebook Messenger. In 1-on-1 conversations, allow changing nickname for both participants. Ensure UI reflects updated nicknames immediately across chat header, message bubbles, and sidebar.

- [x] **Task W-15.5: Group Chat Settings UI Parity**
  - **Platform:** Web
  - **Feature:** Update Group Chat settings sidebar to match standard Messenger-like settings menu (collapsible sections for Chat Info, Customize Chat, Media/Files, Privacy & Support). Ensure all buttons and toggles are fully functional and wired.

### SPRINT M-15 — Mobile Chat UI/UX Refinement `DONE`
> **Follow-up to SPRINT W-15 for Flutter Client Parity**

- [x] **Task M-15.1: Conversation List Subtitle Logic & System Messages Formatting**
  - **Platform:** Mobile (Flutter)
  - **Message Preview:** In the conversation list tile, update the subtitle. For 1-on-1 chats: If the current user sent the last message, display "You: [message]". If the other user sent it, display only "[message]".
  - **System Messages Formatting:** Map backend system events (e.g., `system.theme.changed`, `system.group.created`) to clean, professional human-readable text instead of raw system codes/JSON. Apply to both the conversation list subtitle and the main chat `MessageBubble`.

- [x] **Task M-15.2: Chat Background Upload & Interactive Preview Modal**
  - **Platform:** Mobile (Flutter)
  - **Fix:** Fix any current issues preventing chat background images from uploading correctly via `chatService`.
  - **Feature:** Live Preview Modal. When uploading a new background image, do not apply it immediately. Open a Preview Modal with a mockup chat interface and dummy messages over the newly uploaded background. Allow the user to adjust, crop, or scale the image within this modal. Apply the exact cropped/adjusted image only on "Submit/Save".

### SPRINT W-16 — Phase 2: Bug Fixes, UI/UX Refinement & Profile Overhaul `DONE`
> **Based on AI Codebase Planner & Execution Prompt - Part 2**

- [x] **Task W-16.1: Shared Media & Links Gallery Bug (Web)**
  - Debug the media parsing and rendering logic in the shared gallery component in chat settings. Ensure proper URLs are passed and the UI handles missing or loading assets gracefully without crashing.

- [x] **Task W-16.2: Call Log Indicators in Chat (Web)**
  - Update the system message for ended calls explicitly stating "Voice Call" or "Video Call" (e.g., "Video call ended - 01:03"). Add corresponding UI icons (phone/video camera) next to the call duration.

- [x] **Task W-16.3: Toast Notification Repositioning (Web)**
  - Modify the global toast/notification provider configuration. Move the anchor position to the Top-Center of the screen. Ensure proper z-index and smooth slide-in/out animations.

- [x] **Task W-16.4: Notification Permission Logic Flow (Web & Mobile)**
  - Refactor the permission request trigger. The prompt asking to enable notifications must only appear *after* the user has successfully registered or logged in for the first time. It should never trigger on public landing/login pages.

- [x] **Task W-16.5: Sidebar Header UI Consolidation (Web)** **DONE (2026-06-16, QC sprint) — the "+" dropdown (Create New Chat / Create New Group) already existed in `(main)/layout.tsx`, but `ConversationList.tsx` duplicated Explore (Hash) + New Conversation (Plus) + `ActiveFriendsRow` on top of it. Removed the duplicates from `ConversationList.tsx`; layout.tsx header is now the single source of truth.**

- [x] **Task W-16.6: Profile Modal Overhaul & Bio State Bug (Web)**
  - **Bug Fix:** Fix the issue where "Bio" saves the first time but disappears when reopening. Bind bio text input properly.
  - **UI Redesign:** Mimic modern floating card layout (like Zalo's profile card) showing cover photo, avatar, name, and details.
  - **Access Control:** Include "Edit" button for self profile; make other's profile view-only.
  - **Field Removal:** Completely remove the "Date of Birth" field from viewing and editing.

### SPRINT W-17 — Phase 3: Authentication, Media Persistence & Core UX Fixes `DONE`
> **Based on AI Codebase Planner & Execution Prompt - Part 3**

- [x] **Task W-17.1: Reaction Notification in Chat Sidebar (Web)**
  - Update the sidebar chat list preview subtitle. When another user reacts, display: "[User] reacted to your message" in real-time.

- [x] **Task W-17.2: Critical Auth Fix: Sudden Logout (Token Expiry) (Web)**
  - Implement silent authentication/seamless token refreshing. Configure HTTP interceptors (Axios) to catch 401 Unauthorized errors, use refresh token to get a new access token, and retry the failed request without logging the user out.

- [x] **Task W-17.3: Privacy Policy Link Routing (Web)** **VERIFIED FIXED (2026-06-16, QC sprint) — `/privacy` route exists (`app/(auth)/privacy/page.tsx`) and register page links to it correctly.**
  - Fix the routing configuration or link path so users can successfully navigate to the "Privacy Policy" page from the Registration/Login screens.

- [x] **Task W-17.4: Avatar & Cover Photo Persistence + Cropper (Web)**
  - **Bug Fix:** Bind global state properly to DB update so Avatar changes persist.
  - **Feature:** Implement logic to upload and change a cover photo.
  - **UX Improvement:** Both Avatar and Cover Photo uploads must open a Preview/Cropper Modal. Adjust image -> "Confirm" inside modal -> explicitly click "Save Changes" on profile form.

- [x] **Task W-17.5: Mobile-Web Navigation Bug (Web)** **VERIFIED FIXED (2026-06-16, QC sprint) — `layout.tsx` Profile/Settings menu items use `router.push()` correctly; both target pages exist.**
  - On responsive web version, fix click/tap event handlers for "Personal Profile" and "Settings" so they successfully route the user to corresponding views.

- [x] **Task W-17.6: Global Chat Search Scope (Web)** **VERIFIED FIXED on web (2026-06-16, QC sprint) — `ConversationList.tsx` already filters by group name + nickname + cached display name. Mobile (Flutter) was missing this feature entirely — added in the same QC sprint, see new `conversation_search_bar.dart`.**
  - Update the sidebar search bar filter logic to search through both Group names AND individual User names/nicknames in 1-on-1 chats, rendering them correctly in the results list.

### SPRINT QC-1 — Full Web + Mobile UI Audit `DONE`
> Plan & findings: `_workspace/04_qc_audit_plan.md`. Branch: `chore/full-qc-ui-audit`.
> 2 parallel audit agents swept every screen for non-functional buttons / unfinished
> features on both platforms, cross-checked against the still-open W-16.5/W-17.3/5/6
> backlog above (3 of those turned out to already be fixed — verified and closed).

- [x] **Task QC-1.1 [Web]: "Leave Group" button was a no-op** (`toast('Coming soon')`) — now calls `chatService.removeMember(id, currentUserId)`, mirrors Flutter's leave-group flow, with confirm dialog + i18n.
- [x] **Task QC-1.2 [Web]: Duplicate sidebar nav buttons** — Explore/New-Conversation/ActiveFriendsRow were rendered in both `layout.tsx` and `ConversationList.tsx`; removed the duplicates (closes W-16.5 fully).
- [x] **Task QC-1.3 [Mobile]: "Delete Conversation" button was a no-op** (`onTap: () {}`) — wired to confirm dialog → `conversationsNotifierProvider.deleteConversation()`.
- [x] **Task QC-1.4 [Mobile]: AI persona avatar used a raw URL text field** — replaced with tap-to-upload (image_picker → `chatRepository.uploadFile`), matching web's W-14.7 upgrade.
- [x] **Task QC-1.5 [Mobile]: Conversation list had no search** — added `ConversationSearchBar` + `filterConversationsBySearch()`, mirrors web's `resolveSearchTerms()` (group name / nickname / cached display name).

Verification: `npx tsc --noEmit` + `pnpm build` (web) clean; `flutter analyze` + `flutter test` (client) clean.

### SPRINT QC-2 — Full-Project Hidden-Bug Sweep `DONE` (2026-06-16)
> 4 parallel deep-audit agents (backend / mobile / web / cross-platform sync). Phase 1
> static analysis clean on all 4 stacks. Clear bugs fixed autonomously; large
> feature-parity gaps deferred to a decision list (see below).

**Fixed (verified):**
- [x] **[Web] Infinite scroll dead** — `use-messages.ts`/`types.ts` read `hasMore`/`nextCursorId` but backend `PageResponse` returns `hasNext` + content (DESC). Now uses `hasNext` + oldest-message-id cursor → older history loads again.
- [x] **[Web] Sidebar not realtime** — `(main)/layout.tsx` notification handler now invalidates `['conversations']` so non-open chats refresh last-message/unread live.
- [x] **[Web] Reaction toggle ignored userId** — `MessageActions.tsx` now matches `emoji && userId === currentUserId` (was removing others' reactions).
- [x] **[Web] KB back-link 404** — `kb/[conversationId]/page.tsx` `/chat/` → `/conversations/`.
- [x] **[Mobile] 7 P0 crash/auth** — WebRTC signal null-casts, `current.first` on empty list, `displayName` hard-cast, OTP error render (String/List), brittle message/date parse, authDio had NO token-refresh interceptor (now added).
- [x] **[Mobile] P1** — friend-status checked never-true `'pending'` (→ outgoing/incoming, stops duplicate requests); Terms link opened `/privacy`; group rename/add/remove/**leave** silently swallowed errors; OAuth no-op feedback; missing `mounted` guard; system-message i18n + wrong button-label mapping; missing ARB keys backfilled in 5 locales.
- [x] **[Backend] markConversationRead** made atomic (`$addToSet` updateMulti) — was read-modify-write race.

**QA LOG — QC Full 2026-06-16**
Phase 1: auth build ✓ | chat compile ✓ | flutter analyze ✓ (0) | web tsc ✓
Phase 2: auth test 9/9 ✓ | chat test 87/87 ✓ | flutter test ✓ | web build ✓
Phase 5 issues fixed: Web 4, Mobile 13, Backend 1. Status: clear bugs CLEAN; feature-parity gaps tracked for decision.

**Feature-parity + P2 + refactor (DONE, 2026-06-16 — same sprint, all verified):**
- [x] **[Web] Read receipts** — sent/seen ticks in MessageBubble + `MESSAGE_READ` STOMP handler (cache patch, no refetch) + `/app/chat.read` publishing. Parity with mobile.
- [x] **[Web] Profile fields + privacy** — dateOfBirth/phoneNumber/gender/hideInfo in edit form + UserProfileDrawer gated by `hideInfo`.
- [x] **[Web] Conversation-list ContextMenu** (read/unread, mute, archive, info, block, delete), Copy message action, @mention resolves to display names.
- [x] **[Web] i18n sweep complete** — all 7 locales at full parity (575 keys each); reply-preview author fix; locale-aware date/number; scoped invalidations; `<img>`→`<Image>`.
- [x] **[Web] Refactor** — conversations/[id]/page.tsx 569→380, MessageInput 528→397 (extracted hooks + MessageList/EmojiStickerPicker). `profile/page.tsx` 457 left (minor over-limit, follow-up).
- [x] **[Mobile] Voice calls + call log** — isVideo flag through call stack, incoming video from SDP m=video, `system.call.*` written on hangup + rendered with phone/video icon.
- [x] **[Mobile] Friends management** — global search/add, decline request, unfriend from list.
- [x] **[Mobile] Correctness** — deleteForMe/recall/edit/reaction rollback + error SnackBar; silent refetch (no spinner flash); AI streaming 30s watchdog + correlation-id; missing invalidations; group read-tick hidden in groups (parity).
- [x] **[Mobile] P2** — `_clearCredentials` only token keys; reset-password full policy; `absoluteMediaUrl`→core/utils + persona avatar; presence debounce; token-usage shared Dio.
- [x] **[Mobile] Refactor** — 8 files split under limits; chat_screen.dart (625) & chat_provider.dart (872) left (further split needs behavior change).

**QA LOG — Final verification (post feature-parity):** web tsc ✓ + build ✓ | flutter analyze ✓ (0) + test ✓ | chat compile ✓ + test 87/87 ✓ | auth test 9/9 ✓. 112 files changed. Status: ALL GREEN.

### SPRINT QC-2 — LIVE RUNTIME TEST (Phase 3/4) `DONE` (2026-06-16)
> Brought up Docker (mongo:27018 + redis:6379) + auth-service (3001) + a real chat-service (on 8081, since 8080 was occupied by an unrelated Payara server) and ran the full integration flow.

**🔴 P0 FOUND + FIXED at runtime (static audit missed it):** auth-service leaked `otpCode`/`otpExpires` in `GET /api/users/me` AND `GET /api/users/search` → searching any user exposed their live OTP (account-takeover). Fix: `select:false` on otpCode/otpExpires in `packages/database/src/mongo/user.schema.ts`; `findByEmail`/`findByPhone` now `.select('+password +otpCode +otpExpires')` for the internal OTP/login flow. Verified: /me + /search no longer leak; verify-otp still succeeds; auth tests 9/9.

**Live results:** register/login/verify-otp ✓ | /me + /search no leak ✓ | JWT alignment auth↔chat: valid→200, bad→401 ✓ | create conversation ✓ | send message ✓ | **GET messages returns `{content,page,size,totalElements,hasNext}`** (confirms the web pagination fix matches the real backend) ✓ | read receipt: readBy updates atomically ✓ | presence 200 ✓.

**CONFIG fixes (DONE + verified):**
1. [x] auth-service `MONGO_URI` → added `/platform` db path (`mongodb://localhost:27018/platform?directConnection=true`). Was writing to db `test`. Verified: a fresh register now lands in `platform.users`. ⚠️ Existing users in `test.users` are no longer visible — migrate if any real data: `db.test.users.find().forEach(d=>db.platform.users.insertOne(d))`. Production Cloud Run MONGO_URI must also include the db name.
2. [x] chat-service `application.yml` redis url now defaults to `redis://${SPRING_DATA_REDIS_HOST:localhost}:${SPRING_DATA_REDIS_PORT:6379}` instead of empty → boots locally without `SPRING_DATA_REDIS_URL` (verified: HTTP 200, no "scheme null"). Prod url env still overrides.
3. [x] Doc drift fixed in chat-service CLAUDE.md (now shows the real `SPRING_DATA_*` var names).
4. Note: port 8080 is held by an unrelated "Payara Server 7" (404 for our routes) — our chat-service was tested on 8081. Not a code issue.

### SPRINT QC-3 — Full-Project QC + Deep Debug `DONE` (2026-06-24)
> 4 parallel deep-audit agents (backend / mobile / web / cross-platform sync). Every agent finding was
> independently re-verified against the real code before any fix — several "P1" claims were rejected as
> false positives (see below).

**QA LOG — QC Full 2026-06-24**
Phase 1: auth build ✓ | ai build ✓ | chat compile ✓ | flutter analyze ✓ (0 issues) | web tsc ✓ + build ✓
Phase 2: auth 53/53 ✓ | ai 299/299 ✓ | chat 99/99 ✓ (1 Testcontainers test needs Docker) | flutter ✓ | web 61/61 ✓

**Fixed (verified):**
- [x] **[chat-service] AI addressed user by ObjectId** — `MessageController`/`ChatController` passed `uid` as both userId and displayName to `publishAiRequest`, so the AI system prompt read "You are helping <ObjectId>". Added `MessageService.resolveDisplayName()` (looks up `users.displayName`, falls back to uid); updated `ChatControllerTest`.
- [x] **[web] ESLint error** — `usage-dashboard.tsx` `useMemo(buildMonthOptions, [])` violated `react-hooks/use-memo`; now an inline arrow. Web ESLint back to 0 errors.
- [x] **[web] Link preview** — `media.ts` `firstUrl()` regex captured trailing punctuation ("…x.com." → bad URL); now strips trailing `.,;:!?` and excludes `<>"'`.
- [x] **[ai-service] Empty history turn** — `ai.service.ts` `buildHistoryMessages` could push blank content to the Anthropic API; now drops empty/blank turns (consistent with the image branch).
- [x] **[ai-service] KB embedding guard** — `kb-processor.service.ts` could call `ensureCollection` with an undefined dimension on a degenerate embed result; now guards and throws a clear error.
- [x] **[Flutter] Silent persona swallow** — `chat_provider.dart` persona-fetch `catchError` was a silent no-op; now logs via `debugPrint` (still degrades gracefully to default persona).
- [x] **[Flutter] i18n** — `forward_dialog.dart` hardcoded `'Error: $e'` / `'Group'`; now `l10n.errorWithMsg` + new `groupDefaultName` key across all 7 ARBs.

**Rejected after verification (false positives — no change needed):**
- Dio `async onRequest`/`onError` "drops auth header" — incorrect; Dio awaits before `handler.next()`, the token IS attached (idiomatic pattern).
- Accept-stranger "doesn't refresh list" — `chat_screen.dart` already calls `refresh()` after accept.
- Web missing `__AI_RATE_LIMITED__` sentinel — not reachable; web shows AI errors as a toast, never assigns sentinel content.

**Docs cleanup (same sprint):** removed two unreferenced generic debug-scratch docs (`docs/deep_debug_strategy.md`, `docs/hidden_bug_audit_checklist.md`); refreshed `README.md`, `docs/roadmap.md`, `PON-ENTERPRISE-HANDOFF.md`, and this file to current state.
