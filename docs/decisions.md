# Architecture Decision Records (ADR)

Ghi lại tất cả quyết định kiến trúc quan trọng của dự án Platform.
Tài liệu này captures toàn bộ những gì đã được thảo luận và quyết định.

---

## ADR-001: Giữ NestJS auth-service, không migrate sang Java

**Ngày:** 2026-05-15  
**Trạng thái:** Accepted

**Bối cảnh:** Cần tech stack Java Enterprise cho PRJ4. Auth service đang chạy ổn với NestJS.

**Quyết định:** Giữ nguyên NestJS auth-service. Không migrate sang Spring Boot.

**Lý do:**
- Auth service đã hoàn chỉnh: JWT, refresh token, OTP email, social login (Google/Facebook/X), brute force protection
- Migration sẽ tốn thời gian không cần thiết và risk cao (Redis session, social OAuth flow phức tạp)
- PRJ4 yêu cầu Java Enterprise — chat-service Spring Boot là đủ để đáp ứng

**Hệ quả:** Chat service (Spring Boot) validate JWT do auth service issue. JWT secret phải giống nhau.

---

## ADR-002: Replace Go chat-service bằng Spring Boot 3

**Ngày:** 2026-05-15  
**Trạng thái:** Accepted

**Bối cảnh:** chat-service hiện tại viết bằng Go (Gin), chỉ là skeleton, chưa có persistence.

**Quyết định:** Xóa toàn bộ Go code, viết lại bằng Spring Boot 3 + Jakarta EE 10.

**Lý do:**
- Go code chỉ là skeleton (không có MongoDB persistence, không có room/conversation management đầy đủ)
- Spring Boot 3 đáp ứng trực tiếp PRJ4: `7091-BJWA` (Spring Framework), `7091-WCD` (Jakarta EE), `7091-CSW` (Creating Services for the Web), `7091-EAD` (Enterprise Application)
- Spring WebSocket + STOMP là standard cho Java enterprise WebSocket

**Tech stack chọn:**
- Spring Boot 3.x, Spring Framework 6.x, Jakarta EE Platform 10
- Spring Data MongoDB (standard, không reactive)
- Spring Security 6 cho JWT validation
- Lombok để giảm boilerplate
- Maven build tool

---

## ADR-003: Replace React Native bằng Flutter

**Ngày:** 2026-05-15  
**Trạng thái:** Accepted

**Bối cảnh:** Client hiện tại là React Native (Expo). PRJ4 yêu cầu Flutter/Dart (7091-IDP, 7091-ADFD).

**Quyết định:** Viết lại client bằng Flutter. React Native cũ giữ lại để tham khảo logic.

**Lý do:**
- 7091-ADFD yêu cầu Flutter SDK 1.22+ với Dart 2.10+
- React Native auth screens có thể port logic sang Flutter (API calls giống nhau)
- Flutter/Dart có null safety mạnh hơn JS

**State management chọn:** Riverpod (flutter_riverpod + riverpod_annotation)
**Navigation:** go_router
**WebSocket:** stomp_dart_client (STOMP protocol để connect với Spring Boot)
**HTTP:** Dio với interceptor JWT

---

## ADR-004: MongoDB dùng chung giữa auth và chat service

**Ngày:** 2026-05-15  
**Trạng thái:** Accepted

**Quyết định:** Cả hai service dùng cùng database `platform` trên MongoDB port 27018.

**Lý do:** Project nhỏ (học), overhead của separate DB không cần thiết. User schema do auth-service quản lý, chat service chỉ đọc userId từ JWT.

**Lưu ý:** Chat service KHÔNG write vào `users` collection. Chỉ reference `userId` (string) trong Conversation và Message documents.

---

## ADR-005: Monorepo pnpm workspace

**Ngày:** Trước 2026-05 (giữ nguyên)  
**Trạng thái:** Accepted

**Quyết định:** Giữ monorepo structure với pnpm workspaces cho JS/TS packages. Flutter và Spring Boot là separate projects trong `apps/`.

**Package managers:**
- JS/TS: pnpm (không dùng npm hoặc yarn)
- Java: Maven
- Flutter: flutter pub

---

## ADR-006: WebSocket protocol chọn STOMP over raw WebSocket

**Ngày:** 2026-05-15  
**Trạng thái:** Accepted

**Quyết định:** Dùng STOMP protocol trên WebSocket, không dùng raw WebSocket.

**Lý do:**
- Spring Boot có native support cho STOMP qua `spring-websocket`
- STOMP có pub/sub model built-in (subscribe to `/topic/conversation/{id}`)
- `stomp_dart_client` package cho Flutter hỗ trợ tốt
- Dễ implement typing indicator và presence hơn raw WebSocket

**STOMP endpoints:**
- Connect: `/ws` (SockJS-compatible)
- Subscribe conversations: `/topic/conversation/{conversationId}`
- Subscribe personal: `/user/queue/notifications`
- Send: `/app/chat.send`
- Typing: `/app/chat.typing`
