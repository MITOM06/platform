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

### SPRINT W-2 — Auth UI `PENDING`
- [ ] **Task W-2.1: Login Page**
  - Implement email/password form with shadcn UI and Zod validation.
- [ ] **Task W-2.2: Registration Page**
  - Form fields for email, password, and display name.
- [ ] **Task W-2.3: Verify OTP Page**
  - 6-digit OTP input with resend timer.
- [ ] **Task W-2.4: Cookie-based Auth Handlers**
  - Next.js route handlers `set-cookie` and `clear-cookie` for httpOnly refresh tokens.
- [ ] **Task W-2.5: Logout & Error UI**
  - Invalidate session, clear cookies, and show error notifications via shadcn `useToast`.

### SPRINT W-3 — Chat Core `PENDING`
- [ ] **Task W-3.1: Sidebar & Layout**
  - Build responsive split layout (conversation list sidebar + message thread main area).
- [ ] **Task W-3.2: Fetching Conversations & Messages**
  - Use TanStack Query to fetch conversations and paginated message history.
- [ ] **Task W-3.3: STOMP Client Integration**
  - Subscribe to `/topic/conversation/{id}` for real-time messages and `/topic/conversation/{id}/typing`.
- [ ] **Task W-3.4: Message Send & Optimistic UI**
  - Publish to `/app/chat.send` and dynamically append to message cache.
- [ ] **Task W-3.5: Read Receipts**
  - Mark messages as read via `PUT /api/messages/{id}/read` when conversation opens.

### SPRINT W-4 — Features `PENDING`
- [ ] **Task W-4.1: Search & New Conversation**
  - Search users via `GET /api/users/search?q=` and initiate chats.
- [ ] **Task W-4.2: Typing Indicators & Online Status**
  - Show real-time typing indicators and online dot.
- [ ] **Task W-4.3: Global Notifications**
  - Subscribe to `/user/queue/notifications` and trigger browser notifications.
- [ ] **Task W-4.4: AI Bot Integration**
  - Render AI badge and support streaming AI message bubbles.
- [ ] **Task W-4.5: Profile Settings & Infinite Scroll**
  - Infinite scroll for historical messages and profile display name/avatar updates.

### SPRINT W-5 — Polish & Deploy `PENDING`
- [ ] **Task W-5.1: Responsive Breakpoints**
  - Support mobile sizes by hiding sidebar and showing back buttons.
- [ ] **Task W-5.2: Theme Support**
  - Toggle between dark/light theme (next-themes).
- [ ] **Task W-5.3: Production Build & Vercel**
  - Build and deploy to Vercel, configuring production environment variables.

---

## 🧪 QA LOG
*(Will be appended after implementation)*
