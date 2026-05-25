# 🛡️ QC AUDIT LOG — PON PROJECT

Chủ quản: **Gemini Code Assist (Planner/QC Role)**

---

## [2026-05-25] Session: STOMP Reliability & Presence Fix

### 📝 Nội dung kiểm tra:
- **Task 7:** Sửa lỗi mất Principal trong EventListener.
- **Task 8:** Đồng bộ hóa dữ liệu Typing Indicator giữa BE và FE.
- **Unit Test:** Cập nhật bộ test cho `ChatController`.

### 🔍 Kết quả Review chi tiết:
1. **PresenceEventListener:** Claude đã chuyển đổi sang `SessionConnectedEvent`. Đây là điểm mấu chốt vì Event này kích hoạt *sau* khi Frame CONNECT được xử lý xong bởi Interceptor. 
   - *Trạng thái:* **PASS**.
2. **Typing Indicator:** `ChatMessageDto` đã có thêm field `typing`. Controller đã broadcast đúng payload `Map<String, Object>`.
   - *Trạng thái:* **PASS**.
3. **Regression Risk:** Tôi đã yêu cầu cập nhật lại `ChatControllerTest.java` vì code cũ sẽ bị fail do thay đổi constructor của `MessageResponse` (sang Record) và logic gửi Notification.
   - *Hành động:* Đã tự tay cập nhật lại file Test để đảm bảo build không bị gãy.

### 🚩 Issue phát hiện & Đã xử lý:
- **Issue:** `PresenceEventListener` vẫn dùng cách cũ để lấy Principal dẫn đến rủi ro null nếu handshake chưa hoàn tất.
- **Fix:** Đã hướng dẫn Claude dùng `StompHeaderAccessor.wrap(event.getMessage()).getUser()`.

---

## [2026-05-25] Session: WebSocket STOMP Foundation
- ✅ Task 1 -> 6 hoàn thành và đã được verify compile success.
- ✅ Đã có `AuthChannelInterceptor` bảo vệ tầng WebSocket.
- ✅ Đã có Redis Presence để tracking trạng thái online.

---

## [2026-05-25] Session: DevOps & Flutter UI (Task 9 & 10)

### 📝 Nội dung kiểm tra:
- **Task 9:** Đóng gói Docker chat-service và tích hợp Compose.
- **Task 10:** Màn hình tạo hội thoại mới trên Flutter.

### 🔍 Kết quả Review chi tiết:
1. **DevOps:** Dockerfile tối ưu size image (Multi-stage). Compose config `chat-mongo` healthcheck chính xác để Spring Boot chờ DB ready.
   - *Trạng thái:* **✅ PASS**.

---

## [2026-05-25] Session: UI Refinement & Unit Testing (Task 11 & 12)

### 📝 Nội dung kiểm tra:
- **Task 11:** Trạng thái online và tích xanh đã đọc trên Flutter.
- **Task 12:** Bộ Unit Test cho Chat Service (Backend).

### 🔍 Kết quả Review chi tiết:
1. **Flutter:** `MessageBubble` xử lý `Opacity` cho tin nhắn đang gửi (pending) giúp UI không bị khựng. Logic Read Receipt dựa trên `readBy` list là chính xác.
2. **Backend Test:** Các test case cover đủ các lỗi bảo mật (JWT invalid, Unauthorized access tới conversation).
   - *Trạng thái:* **✅ PASS**.

---

## [2026-05-25] Session: Pre-Sprint 4 Refinement
### 🔍 Vấn đề đã xử lý:
- Đồng bộ lại `ChatControllerTest` với kiểu dữ liệu `Record`.
- Xác định lỗi hổng "Stale Presence" và đưa vào Task 13.
- Lên kế hoạch Real-time Read Receipt qua WebSocket để tối ưu trải nghiệm.

---

## [2026-05-25] Session: Sprint 4 Completion (Task 13 & 14)
### 🔍 Kết quả Review chi tiết:
1. **Heartbeat & Read Receipts**: `AuthChannelInterceptor` hiện đã gia hạn TTL Redis trên mọi frame, giải quyết triệt để lỗi User bị offline khi đang treo máy. Logic STOMP Read Receipt giúp UI đồng bộ tức thì.
2. **Pagination**: Phân trang hoạt động chính xác ở cả 2 đầu. Spinner loading xuất hiện đúng vị trí và không làm nhảy ScrollView.
   - *Trạng thái:* **✅ QC PASS**.

---

## [2026-05-25] Session: Final Quality Gate (End of Day)
### 🔍 Kết quả tổng duyệt:
- **Auth Flow:** Đảm bảo tính nhất quán từ JWT Filter (HTTP) đến STOMP Interceptor (WS).
- **Performance:** Aggregation query và Redis Heartbeat hoạt động đúng như thiết kế để giảm tải hệ thống.
- **Clean Code:** Đã rà soát và loại bỏ các đoạn code dư thừa trong lớp Controller và Test.
   - *Trạng thái:* **💎 EXCELLENT (READY TO DEPLOY)**.
2. **Flutter UI:** `NewConversationScreen` dùng Form validator chuẩn. Tích hợp FAB vào list screen giúp người dùng dễ tiếp cận.
   - *Trạng thái:* **✅ PASS**.