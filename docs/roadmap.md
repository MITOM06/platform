# Roadmap — Platform PRJ4

> **Trạng thái:** Tất cả Milestone 0–4 hoàn thành ✅ (2026-05-30 Sprint 6 DONE)

---

## Milestone 0 — Setup ✅ DONE

- [x] Monorepo structure (pnpm)
- [x] Docker infra: MongoDB port 27018 + Redis
- [x] NestJS auth-service hoàn chỉnh (JWT, OTP, refresh, brute force)
- [x] CLAUDE.md + .claude/ directory + AI workflow

## Milestone 1 — Spring Boot Foundation ✅ DONE

- [x] Spring Boot 3 project (Maven, Spring Initializr)
- [x] `pom.xml` đầy đủ dependencies
- [x] `application.yml` (port 8080, MongoDB 27018, Redis 6379)
- [x] `JwtAuthenticationFilter` — validate JWT từ auth-service
- [x] `SecurityConfig` + CORS config
- [x] `GET /health` endpoint
- [x] Dockerfile multi-stage (maven:21 → jre-alpine)
- [x] `compose.yml` thêm chat-service container

## Milestone 2 — Core Data Layer ✅ DONE

- [x] `Conversation` + `Message` entities (`@Document`) + Repositories
- [x] `ConversationService` + `MessageService`
- [x] REST endpoints: conversations CRUD + messages paginated
- [x] `GlobalExceptionHandler` (404, 409, 401)
- [x] MongoDB aggregation cho unread count (tránh N+1)
- [x] Atomic `markAsRead` với `$addToSet`

## Milestone 3 — WebSocket (STOMP) ✅ DONE

- [x] `WebSocketConfig` — raw WebSocket `/ws` (không SockJS)
- [x] `ChatController` (`@MessageMapping`) — send, typing, read
- [x] `AuthChannelInterceptor` — JWT validate trên STOMP CONNECT
- [x] Presence heartbeat: Redis TTL refresh trên mọi STOMP frame
- [x] `PresenceEventListener` — online/offline via Redis
- [x] `GET /api/users/{id}/status` — check online status
- [x] Broadcast NEW_MESSAGE notification tới `/user/queue/notifications`

## Milestone 4 — Flutter Client ✅ DONE

- [x] Flutter 3.44.0 setup, pubspec.yaml, lib/ structure
- [x] `DioClient` — authDio + chatDio với JWT interceptor + token refresh
- [x] Auth feature: Login, Register, VerifyOtp, ForgotPassword, NewPassword screens
- [x] Chat feature: ConversationList, Chat, NewConversation screens
- [x] `StompService` (keepAlive) — connect/reconnect/subscribe lifecycle
- [x] Typing indicator 3s timer per userId
- [x] Online/offline status + read receipts (2 tick xanh)
- [x] Message pagination (load more, spinner top)
- [x] Settings screen (avatar initials, edit display name)
- [x] Network error toast + token expiry auto logout
- [x] Dark Neon UI theme: NeonButton, NeonTextField, NeonCard, PonLogo

## Milestone 5 (Sprint 5–6) ✅ DONE

- [x] `UsersController` (auth-service): GET /me, /search, /:id
- [x] JWT env alignment: `JWT_ACCESS_SECRET` fail-fast (no hardcoded fallback)
- [x] CORS config trên chat-service REST API
- [x] Email → UserId resolution khi tạo conversation
- [x] Auth flow bug fixes: OTP send, sid in login, resend OTP, verify sets isVerified
- [x] Unit tests: 26/26 Spring Boot, flutter analyze clean

## Post-PRJ4 (Backlog)

- [ ] Group chat
- [ ] Image/file upload (S3/Cloudinary)
- [ ] Push notifications (FCM)
- [ ] Search messages
- [ ] End-to-end encryption
