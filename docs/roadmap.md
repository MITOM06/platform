# Roadmap — Platform Project

> **Status:** Milestones 0–4 + Sprints 12–17 Completed ✅
> **Current Sprint:** Sprint 17 — COMPLETED ✅ (See `TODO.md`)

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

## Milestone 5 (Sprint 5–11) ✅ DONE
- User Profile (Bio, Cover Photo, Friend Counts)
- Group Chat logic (BE/FE integration)
- Block User feature
- Active Friends row with presence time
- Friend Requests / Contacts System
- UI improvements (Neon theme fixes)

## Post-Milestone 5 (Sprints 12–17) ✅ COMPLETED
*(See `TODO.md` for detailed specs)*
- [x] **Sprint 12 ✅** Edit Message, Generic File Upload, Cursor-based Pagination, Link Preview
- [x] **Sprint 13 ✅** Mention System, Message Search, True Unread Counts
- [x] **Sprint 14 ✅** Public Channels, Pin/Forward Messages, Markdown Render
- [x] **Sprint 15 ✅** Offline Catch-up, Rate Limiting (Redis sliding-window + client SnackBar)
- [x] **Sprint 16 ✅** Shared Media Gallery (3-tab), Reactions Detail Modal (draggable sheet)
- [x] **Sprint 17 ✅** Profile & UX Enhancements — DOB selector, Cover Photo upload, Change Password, Double-Tap Quick Reaction (❤️)
