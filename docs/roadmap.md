# Roadmap — Platform PRJ4

Lộ trình phát triển theo milestone, ưu tiên hoàn thành PRJ4 đúng hạn.

## Milestone 0 — Setup (Đã xong ✅)

- [x] Monorepo structure (pnpm)
- [x] Docker infra: MongoDB replica set + Redis
- [x] NestJS auth-service hoàn chỉnh
- [x] React Native auth screens (tham khảo)
- [x] CLAUDE.md + .claude/ directory
- [x] Architecture decisions documented

## Milestone 1 — Spring Boot Foundation

**Mục tiêu:** Spring Boot project chạy được, connect MongoDB + Redis, JWT validation hoạt động.

- [ ] Khởi tạo Spring Boot project (Maven, Spring Initializr)
- [ ] `pom.xml` với đủ dependencies (web, websocket, data-mongodb, security, data-redis, lombok, jjwt)
- [ ] `application.yml` config (port 8080, MongoDB 27018, Redis 6379)
- [ ] `JwtAuthenticationFilter` — validate token từ auth-service
- [ ] `SecurityConfig` — configure Spring Security 6
- [ ] `GET /health` endpoint — verify service chạy
- [ ] Dockerfile cho chat-service
- [ ] Update `compose.yml` thêm chat-service container

**Verify:** `mvn spring-boot:run` → `curl http://localhost:8080/health` → `{"status":"ok"}`

## Milestone 2 — Core Data Layer

**Mục tiêu:** MongoDB entities + repositories + service layer cho conversations và messages.

- [ ] `Conversation` entity (`@Document`) + `ConversationRepository`
- [ ] `Message` entity (`@Document`) + `MessageRepository`
- [ ] `ConversationService`: tạo conversation, list by user, find by ID
- [ ] `MessageService`: send message, get paginated messages, mark as read
- [ ] REST endpoints:
  - `GET /api/conversations` — list conversations của current user
  - `POST /api/conversations` — tạo 1-on-1 conversation
  - `GET /api/conversations/{id}/messages?page=0&size=20`
  - `PUT /api/messages/{id}/read`

**Verify:** Postman/curl với JWT token → CRUD conversations và messages

## Milestone 3 — WebSocket (STOMP)

**Mục tiêu:** Realtime messaging hoạt động qua WebSocket.

- [ ] `WebSocketConfig` — configure STOMP endpoint `/ws`
- [ ] `ChatController` (`@MessageMapping`) — handle incoming STOMP messages
- [ ] Broadcast message tới `/topic/conversation/{id}`
- [ ] Personal notification tới `/user/queue/notifications`
- [ ] Typing indicator: `/app/chat.typing` → broadcast tới conversation
- [ ] Presence (online/offline) via Redis: update khi connect/disconnect WebSocket
- [ ] `GET /api/users/{id}/status` — check online status

**Verify:** 2 clients WebSocket connect → gửi message → cả 2 nhận được realtime

## Milestone 4 — Flutter Client

**Mục tiêu:** Flutter app chạy được với đầy đủ auth flow và chat UI.

- [ ] Khởi tạo Flutter project trong `apps/client/`
- [ ] Setup dependencies: flutter_riverpod, go_router, dio, stomp_dart_client, flutter_secure_storage
- [ ] `DioClient` với JWT interceptor
- [ ] Auth feature:
  - [ ] `LoginScreen` → `POST /auth/login`
  - [ ] `RegisterScreen` → `POST /auth/register`
  - [ ] `VerifyOtpScreen` → `POST /auth/verify-otp`
  - [ ] `ForgotPasswordScreen` + `NewPasswordScreen`
  - [ ] `AuthProvider` (Riverpod) — manage auth state + token storage
- [ ] Chat feature:
  - [ ] `ConversationListScreen` → `GET /api/conversations`
  - [ ] `ChatScreen` → load messages + STOMP WebSocket
  - [ ] `StompService` — manage WebSocket connection lifecycle
  - [ ] Typing indicator UI
  - [ ] Online/offline status indicator

**Verify:** End-to-end: register → login → chat với user khác realtime

## Milestone 5 — Polish & PRJ4 Submission

- [ ] Error handling đầy đủ (network errors, token expiry, reconnect WebSocket)
- [ ] Loading states ở mọi async operation
- [ ] Read receipts (readBy tracking)
- [ ] Basic search conversation
- [ ] Unit tests cho Spring Boot services
- [ ] Widget tests cho Flutter screens
- [ ] Docker Compose full stack (auth + chat + Flutter web hoặc APK)
- [ ] PRJ4 documentation / presentation

## Post-PRJ4 (Backlog)

- Group chat
- Image/file upload
- Push notifications
- Voice messages
- End-to-end encryption
