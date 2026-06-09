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

## 🧪 QA LOG
*(Will be appended after implementation)*
