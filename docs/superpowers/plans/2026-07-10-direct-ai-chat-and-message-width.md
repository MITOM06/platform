# Plan: Chat 1-1 với @AI không cần gõ mention + giới hạn bề rộng bubble AI cho dễ đọc

> **Ngày:** 2026-07-10 | **Scope:** `apps/server/chat-service/` (bắt buộc) + Web `apps/web/` (bubble
> width) — Flutter dùng chung backend nên tự động hưởng fix phần 1, không cần sửa gì thêm ở Flutter.

---

## 1. Chat riêng (1-1) với @AI không cần gõ "@AI" — chat bình thường

### Root cause

`ChatController.java` (STOMP, dòng 32+63) và `MessageController.java` (REST, dòng 37+61) đều dùng
CHUNG 1 quy tắc cho MỌI conversation (group lẫn 1-1): chỉ trigger AI khi nội dung match
`AI_MENTION_PATTERN = "(?i)@(AI|ponai)\\b"`. Không có nhánh nào kiểm tra "đây là conversation 1-1 mà
người kia CHÍNH LÀ AI bot" để bỏ qua yêu cầu mention — do đó user phải tự gõ `@AI` mỗi lần, kể cả khi
đang chat riêng 1-1 chỉ có mỗi AI ở đó (không có ai khác để cần phân biệt gọi ai).

**Đối chiếu ngay trong chính code base:** `ChatController.java` dòng 85-100 — trigger cho personal
assistant (Bot Factory bot, `externalBotService.resolveAssistant(...)`) đã làm ĐÚNG kiểu user muốn:
KHÔNG cần mention, bất kỳ tin nhắn nào trong 1-1 với bot cá nhân cũng tự động trigger reply. `@AI` 1-1
chỉ đơn giản là chưa được đối xử tương tự — không phải giới hạn kỹ thuật, chỉ là thiếu 1 nhánh check.

### Fix — thêm helper xác định "1-1 với AI bot", dùng ở cả 2 nơi

`apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java` —
thêm method (tái dùng participants đã có, tương tự cách dòng 90-92 hiện tại check AI bot cho
auto-accept):

```java
/** True iff `conversationId` is a 1-1 (exactly 2 participants) with the native AI bot as the
 *  other participant — i.e. every message here is implicitly "to the AI", no @mention needed. */
public boolean isDirectAiConversation(String conversationId) {
  Optional<Conversation> conv = conversationRepository.findById(conversationId);
  if (conv.isEmpty()) return false;
  List<String> participants = conv.get().getParticipants();
  return participants.size() == 2 && participants.contains(AiConstants.AI_BOT_USER_ID);
}
```

`ChatController.java` — sửa điều kiện trigger:

```java
// Tìm:
if (dto.getContent() != null && AI_MENTION_PATTERN.matcher(dto.getContent()).find()) {

// Thay thành:
boolean isDirectAi = conversationService.isDirectAiConversation(dto.getConversationId());
boolean hasMention = dto.getContent() != null && AI_MENTION_PATTERN.matcher(dto.getContent()).find();
if (dto.getContent() != null && (hasMention || isDirectAi)) {
```
(Cần inject `ConversationService conversationService` vào `ChatController` nếu chưa có — kiểm tra
constructor hiện tại.)

`MessageController.java` — áp dụng ĐÚNG pattern tương tự (2 nơi phải khớp nhau, đây chính là lý do
file hiện có comment "Same fan-out as the STOMP path" — 2 controller cố tình giữ logic song song).

**Lưu ý:** `stripped = raw.replaceAll("(?i)@(AI|ponai)\\b", "").trim()` giữ nguyên — khi user không
gõ mention, regex này không match gì cả nên `stripped` = nguyên văn tin nhắn, không cần đổi gì thêm.

**Không đổi gì ở Flutter/Web phía trigger** — cả 2 client chỉ gửi content người dùng gõ lên qua REST/
STOMP, logic quyết định "có trigger AI không" nằm 100% ở chat-service, tự động áp dụng cho cả 2
platform sau khi fix backend.

### Việc phụ (không bắt buộc, chỉ dọn UX cho khớp) — web `MessageInput.tsx`

File đã có sẵn `isDirectAiConversation` (dòng 195-197, tính từ `conversation.participants` phía
client) dùng cho gợi ý `/new`. Có thể tận dụng luôn để KHÔNG hiện gợi ý autocomplete "@AI" khi gõ "@"
trong 1-1-với-AI (vì chỉ có 1 người để mention, mention để làm gì) — kiểm tra component autocomplete
mention hiện tại (nếu có) và ẩn nó khi `isDirectAiConversation === true`. Đây chỉ là dọn dẹp gợi ý,
KHÔNG bắt buộc vì kể cả user có gõ "@AI" trong 1-1 vẫn hoạt động bình thường sau fix trên (chỉ là
không BẮT BUỘC nữa).

---

## 2. Bubble tin nhắn AI quá rộng trên màn hình lớn — giới hạn theo độ rộng đọc thoải mái

### Nhận xét trước khi fix (để hiểu đúng vấn đề, không phải bug ngẫu nhiên)

ChatGPT/Claude/Gemini web KHÔNG "làm giao diện hẹp vì kém" — họ CỐ Ý giới hạn cột đọc văn bản dài
(thường ~48rem/768px) bất kể màn hình rộng bao nhiêu, vì dòng chữ quá dài (>90-100 ký tự/dòng) làm mắt
khó theo dõi khi đọc — đây là nguyên tắc typography chuẩn (measure/line-length), không phải hạn chế kỹ
thuật. Cái đáng sửa ở PON không phải "làm cho nó rộng ra giống người ta" — ngược lại, PON hiện đang
**thiếu đúng cái giới hạn đó** cho tin nhắn AI.

### Root cause thật trong code PON

`apps/web/components/chat/MessageBubble.tsx` dòng 294: MỌI loại bubble (text người dùng ngắn lẫn AI
trả lời dài) đều dùng chung `max-w-[70%]` — 1 tỉ lệ PHẦN TRĂM theo container, không phải 1 giới hạn
tuyệt đối theo ký tự/pixel. Trên màn hình rộng (vd cửa sổ 1600-1920px), 70% = ~1100-1340px cho 1 dòng
văn bản — vượt xa mức đọc thoải mái, khiến câu trả lời dài của AI kéo dài gần hết màn hình, đúng như
mày đang thấy "trống 2 bên nhưng chữ vẫn tràn ngang" (bubble message ngắn thì không sao vì tự co theo
nội dung, nhưng bubble AI dài thì bị kéo dãn quá mức).

### Fix

```tsx
// Tìm (MessageBubble.tsx dòng ~294):
<div className="relative flex flex-col gap-1 max-w-[70%]">

// Thay thành — giữ 70% làm trần trên màn hình hẹp, nhưng thêm giới hạn tuyệt đối cho
// bubble loại 'ai' (dùng biến đã có `message.type` trong scope này):
<div
  className={cn(
    'relative flex flex-col gap-1 max-w-[70%]',
    message.type === 'ai' && 'lg:max-w-[640px]',
  )}
>
```

(`640px` ≈ 80-90 ký tự/dòng ở cỡ chữ mặc định — Claude Code có thể tinh chỉnh 600-680px nếu sau khi
xem thực tế thấy chưa vừa mắt; import `cn` đã có sẵn trong file này.)

**Không đổi bubble loại text/image/video của NGƯỜI DÙNG** — tin nhắn người dùng thường ngắn, 70%
percentage-based vẫn hợp lý, không cần giới hạn tuyệt đối.

**Flutter không cần đổi** — màn hình mobile hẹp, 70% của ~360-430dp chưa bao giờ vượt ngưỡng đọc khó
chịu, vấn đề này chỉ xảy ra trên web ở màn hình rộng.

---

## Verification

1. `mvn -q -Dtest=ChatControllerTest,MessageControllerTest test` (chat-service) — thêm test case mới:
   1-1 với AI bot, gửi tin nhắn KHÔNG có "@AI" → vẫn publish `AiRequest`; group chat gửi tin nhắn
   không mention → KHÔNG publish (giữ nguyên hành vi cũ cho group).
2. `pnpm build` (web).
3. Test thủ công: mở 1-1 với @AI, gõ "chào" (không @AI) → AI vẫn trả lời. Mở group có @AI, gõ "chào"
   không mention → AI im lặng như cũ (không đổi hành vi group).
4. Bubble AI trả lời dài (>3-4 dòng) trên màn hình rộng (>1400px) → không còn kéo dài gần hết màn
   hình, dừng ở khoảng 640px, còn tin nhắn ngắn của user vẫn hiển thị bình thường.
