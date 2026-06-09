# TODO — PON PROJECT
> **Workflow:** Gemini Code Assist (Planner/QC) ↔ Tech Lead (Bridge) ↔ Claude CLI (Coder/Tester)
> **Updated:** 2026-06-08
> **Note to Claude:** Sprints 1-24 and AI-1 to AI-6 are completed (see `TODO_ARCHIVE.md` for details). Sprints for Phase 3 (Production Ready) and Web Client (Next.js) are now active.

---

## 📋 PHASE 3 — PRODUCTION READY

### SPRINT P3-1 — CI/CD & Cloud Deployment `PENDING`
- [ ] **Task P3-1.1: GitHub Actions CI/CD Pipeline**
  - Create pipeline running on push to `main`: lint → test → build → push Docker images to Artifact Registry → deploy.
- [ ] **Task P3-1.2: Google Cloud Run Setup**
  - Deploy `auth-service`, `chat-service`, and `ai-service` to Cloud Run.
- [ ] **Task P3-1.3: Production Environment Management**
  - Configure production environment variables and secrets (GCP Secret Manager / GitHub Secrets).
- [ ] **Task P3-1.4: Domain & SSL Configuration**
  - Set up custom domains with SSL certificate management.

### SPRINT P3-2 — Push Notifications (Real FCM) `PENDING`
- [ ] **Task P3-2.1: FCM Token Registration**
  - Replace current no-op stub with real FCM token registration in backend.
- [ ] **Task P3-2.2: Flutter FCM Integration**
  - Implement `flutter_firebase_messaging` and background message handlers.
- [ ] **Task P3-2.3: Deep Linking**
  - Configure notification tap to deep-link directly to the corresponding conversation screen.
- [ ] **Task P3-2.4: Mute Support**
  - Ensure background notifications respect muted conversations.

### SPRINT P3-3 — Performance & Observability `PENDING`
- [ ] **Task P3-3.1: MongoDB Indexes Audit**
  - Add compound indexes for hot query paths (e.g. `conversationId` + `createdAt`).
- [ ] **Task P3-3.2: Redis Caching**
  - Cache conversation lists and user profiles in Redis to minimize database load.
- [ ] **Task P3-3.3: Structured Logging**
  - Use Winston in NestJS services and Logback JSON in Spring Boot for queryable logs.
- [ ] **Task P3-3.4: Health & Uptime Monitoring**
  - Integrate `/health` endpoints and configure monitoring tools.
- [ ] **Task P3-3.5: Error Tracking (Sentry)**
  - Integrate Sentry SDK into Flutter, NestJS services, and Spring Boot.

### SPRINT P3-4 — Security Hardening `PENDING`
- [ ] **Task P3-4.1: OWASP Security Audit**
  - Audit against NoSQL injection, XSS, CSRF, and implement security headers.
- [ ] **Task P3-4.2: Rate Limiting Audit**
  - Audit and apply rate limiting to all REST endpoints and WebSockets inbound channel.
- [ ] **Task P3-4.3: Secure File Uploads**
  - Validate uploads via magic bytes check, size caps, and virus scanning stubs.

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
- [ ] **Task W-10.1: Friends / Contacts** `L` — list, requests, search/add, accept/decline/remove/block (`friends_screen.dart`).
- [ ] **Task W-10.2: Settings screen** `M` — theme, language, account, logout, sub-screen links (`settings_screen.dart`).
- [ ] **Task W-10.3: Change password dialog** `S` (`change_password_dialog.dart`).
- [ ] **Task W-10.4: Token usage screen** `M` — AI quota progress + history (`token_usage_screen.dart`).
- [ ] **Task W-10.5: AI Persona settings** `M` (`ai_persona_screen.dart`).
- [ ] **Task W-10.6: AI Memory screen** `M` (`ai_memory_screen.dart`).
- [ ] **Task W-10.7: Knowledge Base (RAG) screen** `M` (`kb_screen.dart`).
- [ ] **Task W-10.8: Reminders screen** `M` (`reminders_screen.dart`).
- [ ] **Task W-10.9: Group info screen** `M` — extend `GroupSettingsDrawer` (`group_info_screen.dart`).
- [ ] **Task W-10.10: Archived chats** `S` (`archived_chats_screen.dart`).
- [ ] **Task W-10.11: Explore / public channels** `M` — verify `PublicChannelsModal` parity (`explore_screen.dart`).
- [ ] **Task W-10.12: Shared media gallery** `S` — verify `SharedMediaGallery` parity (`explore_media_screen.dart`).
- [ ] **Task W-10.13: User profile + edit profile** `M` (`user_profile_screen.dart`, `edit_profile_screen.dart`).
- [ ] **Task W-10.14: Forgot / reset password** `M` (`forgot_password_screen.dart`, `new_password_screen.dart`).
- [ ] **Task W-10.15: Calls (WebRTC)** `L` — defer; largest item (`call_screen.dart`, `webrtc_service.dart`).
- [ ] **Task W-10.16: Mentions (@) composer + bubble** `M` (`mention_list.dart`).

### SPRINT W-11 — Web Polish & Consistency `PENDING`
- [ ] **Task W-11.1: i18n decision** — web is hardcoded Vietnamese; Flutter has 7 locales (`L` to adopt).
- [ ] **Task W-11.2: Visual parity pass** — PON neon theme, bubbles, avatars, glow spheres `M`.
- [ ] **Task W-11.3: Responsive/mobile audit** `M`.
- [ ] **Task W-11.4: Typing indicator + pinned-bar render parity** `S`.

### SPRINT F-1 — Flutter Runtime Debug `PENDING`
> `flutter analyze` is clean → errors are runtime. Needs a repro (which button throws).
- [ ] **Task F-1.1: Reproduce & log** `M` — run app, click every screen/button, capture stack traces.
- [ ] **Task F-1.2: Fix navigation errors** `M` — unregistered go_router routes / bad params.
- [ ] **Task F-1.3: Fix null-safety / cast errors** `M` in tapped handlers.
- [ ] **Task F-1.4: Fix API-driven error screens** `M` (4xx/5xx).
- [ ] **Task F-1.5: Re-run `flutter analyze` + `flutter test`** `S`.

### Suggested order
1. W-9.2 → W-9.12 (finish web chat — in progress)
2. W-10.13, W-10.2, W-10.1 (profile, settings, friends)
3. W-10.5 → W-10.8 (AI persona/memory/KB/reminders)
4. F-1.1 → F-1.5 (Flutter debug, once repro available)
5. W-10.14, W-10.9 → W-10.12, W-10.16 (remaining parity)
6. W-11.* polish; W-10.15 calls last

---

## 🧪 QA LOG
*(Will be appended after implementation)*
