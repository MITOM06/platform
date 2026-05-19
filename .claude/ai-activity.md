# AI Activity Log

> File này được tự động cập nhật bởi Claude Code hooks sau mỗi thao tác.
> Dùng để track lịch sử AI đã làm gì. Đọc file này khi bắt đầu session mới để nắm context.

---

## Session: 2026-05-19 — Project Setup

**Tóm tắt:** Setup toàn bộ cấu trúc project cho PRJ4. Không có code nào được viết, chỉ config Claude Code.

**Files tạo/sửa:**
- `CLAUDE.md` — root context file (59 dòng, lean)
- `CLAUDE.local.md` — personal session notes template (gitignored)
- `apps/server/chat-service/CLAUDE.md` — Spring Boot context (on-demand)
- `apps/client/CLAUDE.md` — Flutter context (on-demand)
- `.claude/settings.json` — hooks config
- `.claude/hooks/log-activity.sh` — auto-logging hook
- `.claude/rules/auth-guard.md` — luôn load, bảo vệ auth-service
- `.claude/rules/spring-boot.md` — path-scoped cho chat-service/**
- `.claude/rules/flutter.md` — path-scoped cho apps/client/**
- `.claude/skills/implement-feature/SKILL.md`
- `.claude/skills/spring-boot-service/SKILL.md`
- `.claude/skills/flutter-screen/SKILL.md`
- `.claude/skills/fix-issue/SKILL.md`
- `.claude/agents/code-reviewer.md`
- `docs/decisions.md` — 6 ADRs từ cuộc trò chuyện
- `docs/roadmap.md` — 5 milestones
- `docs/api-spec.md` — API contracts cho chat-service

**Quyết định chốt:**
- Go chat-service → replace bằng Spring Boot 3
- React Native → replace bằng Flutter
- NestJS auth-service → giữ nguyên
- State: Milestone 0 hoàn thành, chờ bắt đầu Milestone 1

**Next:** Bắt đầu Milestone 1 — Spring Boot Foundation (setup Maven project, JWT filter, health endpoint)

---
---

## Session: 2026-05-19 — Milestone 1 xác nhận + Milestone 2 hoàn thành

**Tóm tắt:** Milestone 1 (Spring Boot Foundation) đã có sẵn từ session trước. Hoàn thành toàn bộ Milestone 2: data layer + REST API cho conversations và messages.

**Milestone 1 — Đã xong (xác nhận):**
- `SecurityConfig.java`, `JwtAuthenticationFilter.java`, `JwtUtil.java`, `UserPrincipal.java`
- `HealthController.java` — `GET /health`
- `application.yml` — port 8080, MongoDB 27018, Redis 6379
- `pom.xml` — Spring Boot 3.3.5, jjwt 0.11.5, Lombok, MongoDB, Redis, WebSocket

**Milestone 2 — Files tạo mới:**
- `config/MongoConfig.java` — `@EnableMongoAuditing`
- `model/Conversation.java` — `@Document(collection="conversations")`, nested `LastMessage`, `@CreatedDate/@LastModifiedDate`
- `model/Message.java` — `@Document(collection="messages")`, `readBy[]`, `@CreatedDate`
- `repository/ConversationRepository.java` — `findByParticipantsContaining` (pageable), `findOneOnOneConversation` ($all + $size:2)
- `repository/MessageRepository.java` — `findByConversationIdOrderByCreatedAtDesc`, `countUnread` ($nin query)
- `dto/PageResponse.java` — generic record `(content, page, size, totalElements)`
- `dto/ConversationResponse.java` — với nested `LastMessageDto`, `unreadCount`
- `dto/CreateConversationRequest.java`
- `dto/MessageResponse.java`
- `dto/SendMessageRequest.java`
- `exception/ConversationNotFoundException.java`
- `exception/DuplicateConversationException.java`
- `exception/GlobalExceptionHandler.java` — 404, 409, 400 fallback
- `service/ConversationService.java` — list, create (409 if dup), getById
- `service/MessageService.java` — paginated get, send (updates conversation.lastMessage), markAsRead
- `controller/ConversationController.java` — GET/POST /api/conversations, GET /api/conversations/{id}, GET /api/conversations/{id}/messages
- `controller/MessageController.java` — POST /api/messages, PUT /api/messages/{id}/read

**Build:** `mvn compile` — clean, 0 errors

**Quyết định:**
- `countUnread` dùng `@Query` explicit với `$nin` thay vì derived method (an toàn hơn với array fields)
- `findOneOnOneConversation` dùng `$all + $size: 2` để đảm bảo exact match 2 participants
- userId luôn lấy từ `SecurityContextHolder` (UserPrincipal), không tin request params
- Sender tự động thêm vào `readBy` khi gửi tin nhắn

**Next:** Milestone 3 — WebSocket STOMP (`WebSocketConfig` + `ChatController` + typing indicator + presence Redis)

<!-- Các entries mới tự động append bên dưới -->
