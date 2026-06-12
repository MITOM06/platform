# TODO — PON PROJECT
> **Workflow:** Gemini Code Assist (Planner/QC) ↔ Tech Lead (Bridge) ↔ Claude CLI (Coder/Tester)
> **Updated:** 2026-06-12
> **Note to Claude:** Sprints 1-24 and AI-1 to AI-6 are completed (see `TODO_ARCHIVE.md` for details). Sprints for Phase 3 (Production Ready) and Web Client (Next.js) are now active.

---

## 📋 PHASE 3 — PRODUCTION READY

### SPRINT P3-1 — CI/CD & Cloud Deployment `PENDING`
- [x] **Task P3-1.1: GitHub Actions CI/CD Pipeline**
  - Create pipeline running on push to `main`: lint → test → build → push Docker images to Artifact Registry → deploy. **DONE — ci.yml covers auth-service, chat-service, ai-service, web (Next.js), flutter-client. deploy.yml covers all 3 backend services to Cloud Run.**
- [ ] **Task P3-1.2: Google Cloud Run Setup**
  - Deploy `auth-service`, `chat-service`, and `ai-service` to Cloud Run.
- [ ] **Task P3-1.3: Production Environment Management**
  - Configure production environment variables and secrets (GCP Secret Manager / GitHub Secrets).
- [ ] **Task P3-1.4: Domain & SSL Configuration**
  - Set up custom domains with SSL certificate management.

### SPRINT P3-2 — Push Notifications (Real FCM) `DONE`
- [x] **Task P3-2.1: FCM Token Registration** `M`. **DONE — Implemented in auth-service UsersController.addDeviceToken**.
- [x] **Task P3-2.2: Flutter FCM Integration** `L`. **DONE — Implemented in flutter_firebase_messaging and auth_provider**.
- [x] **Task P3-2.3: Deep Linking** `M`. **DONE — Implemented onMessageOpenedApp and getInitialMessage in main.dart**.
- [x] **Task P3-2.4: Mute Support** `S`. **DONE — Implemented in FcmService.java**.

### SPRINT P3-3 — Performance & Observability `PENDING`
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

### SPRINT P3-4 — Security Hardening `PENDING`
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
  - Group messages in the chat history by day and render rounded capsule separators ("Hôm nay", "Hôm qua", or formatted date) with subtle borders.
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

### SPRINT W-9 — Complete Web Chat (CURRENT PRIORITY) `IN PROGRESS`
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
    *(Follow-up W-9.B3: reply-preview sender label still "Bạn"/"Người khác" placeholder.)*
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

### SPRINT W-10 — Missing Web Screens (parity) `PENDING`
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

### SPRINT W-11 — Web Polish & Consistency `PENDING`
- [x] **Task W-11.1: i18n** — web is hardcoded Vietnamese; Flutter has 7 locales (`L` to adopt). **DONE — adopted `next-intl` 4.x (cookie-based locale, no URL prefix). `i18n/request.ts` + `i18n/config.ts` + `messages/{vi,en,zh,ja,ko,es,fr}.json` (vi=full, en=full, others=English stubs). All 21 pages/components updated to `useTranslations()`. Language switcher added to Settings page (cycles all 7 locales, persists via `locale` cookie + `router.refresh()`). `next build` passes clean.**
- [x] **Task W-11.2: Visual parity pass** — PON neon theme, bubbles, avatars, glow spheres `M`. **DONE — own-bubble neon shadow, active conversation neon left-border, online dot #00E676, sidebar ambient glow spheres.**
- [x] **Task W-11.3: Responsive/mobile audit** `M`. **DONE — h-screen→h-dvh, safe-area-inset-bottom on input, emoji picker max-w-[calc(100vw-1rem)], image button hidden on xs.**
- [x] **Task W-11.4: Typing indicator + pinned-bar render parity** `S`. **DONE — header subtitle shows "đang nhập..." (pon-cyan, animate-pulse) when isTyping; PinnedMessage type mismatch fixed.**
- [x] **Task W-11.5: Active Friends Row** `S` — horizontal list above conversations. **DONE — `ActiveFriendsRow.tsx`.**
- [x] **Task W-11.6: Chat Wallpaper full parity** `S` — support custom HTTP image URLs in `ConversationPage`. **DONE — handled absolute URLs with background cover.**
- [x] **Task W-11.7: Quick Reaction & Stickers** `M` — add quick reaction to `MessageInput` and sticker tab to `EmojiStickerPanel`. **DONE — 👍 quick-send button when input is empty; emoji popover now has Emoji/Nhãn dán (sticker) tabs; stickers send as `type:'sticker'`.**
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

### SPRINT W-12 — Web Chat Logic Bug Fixes `IN PROGRESS`
> **Audit (2026-06-11):** 3 bugs + 1 missing feature found in web chat after code review.

- [x] **Task W-12.1: REST sendMessage missing STOMP broadcast** `S`
  - `MessageController.sendMessage` (Spring Boot) saves to DB nhưng **không** broadcast qua STOMP. Kết quả: participant B không nhận tin realtime.
  - Fix: thêm `messagingTemplate.convertAndSend("/topic/conversation/"+convId, response)` sau `messageService.sendMessage(...)`.
  - File: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java`

- [x] **Task W-12.2: isOwn alignment bug** `S`
  - Khi `currentUser` chưa load (null — trước khi `SessionInitializer` xong), tất cả tin nhắn render `isOwn=false` (bên trái). Tin nhắn của A bị hiển thị như tin của B.
  - Fix: guard render messages cho đến khi `currentUser !== null`.
  - File: `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.3: AI STOMP events rơi vào appendMessage** `M`
  - `AI_STREAM_CHUNK`, `AI_STREAM_DONE`, `AI_STREAM_ERROR`, `AI_TOOL_CALL` không nằm trong `STOMP_EVENT_TYPES` → rơi vào `appendMessage` → thêm vào cache như "tin nhắn" rác (không có `id`, không có `content` hợp lệ).
  - Fix: thêm vào `STOMP_EVENT_TYPES`, xử lý streaming state — accumulate chunks → show streaming bubble → finalize khi DONE. `AI_STREAM_ERROR` → toast.
  - File: `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.4: Chat với AI chưa có trên web** `M`
  - Không có button tạo AI conversation. User không thể start chat với AI Assistant từ web.
  - Fix: thêm "Chat với AI" button vào ConversationList sidebar. Click → `POST /api/conversations { participantId: AI_BOT_ID }` → navigate. Trong AI conversation, tự động prepend `@AI ` vào content trước khi send.
  - Files: `apps/web/components/chat/ConversationList.tsx`, `apps/web/app/(main)/conversations/[id]/page.tsx`

- [x] **Task W-12.5: Clear history không clear cache ngay** `S`
  - `invalidateQueries` trigger stale-while-revalidate → user thấy tin nhắn cũ trong khi refetch đang chạy.
  - Fix: dùng `queryClient.removeQueries({ queryKey: ['messages', id], exact: true })` TRƯỚC khi `invalidateQueries` để xoá cache ngay lập tức.
  - File: `apps/web/components/chat/ConversationSettingsDrawer.tsx`

### SPRINT W-13 — Bug Fixes (from production audit 2026-06-12) `PENDING`
> Source: live testing on https://platform-web-omega-amber.vercel.app after GCP migration.
> Read `apps/web/CLAUDE.md` before starting. All fixes are in `apps/web/`.

- [x] **Task W-13.1: Own messages render on wrong side** `S`
  - Symptom: messages sent by current user appear left-aligned (isOwn=false).
  - Root cause to verify: `msg.senderId` format may differ from `currentUser.id`
    (e.g. MongoDB ObjectId string vs auth-service UUID). Log both in browser console and compare.
  - Fix: normalise comparison or trace where `senderId` is populated on optimistic append.
  - File: `apps/web/app/api/auth/session/route.ts` — normalise `id: data.id || data._id` so `currentUser.id` is always populated even when Mongoose omits the virtual.

- [x] **Task W-13.2: Typing indicator visible to the typer themselves** `S`
  - Symptom: when current user types, "đang nhập…" appears in their own chat header.
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

### SPRINT W-14 — UX/UI Refinement (Audit 2026-06-12) `PENDING`
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
