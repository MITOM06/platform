# Phòng họp P2 — AI trong họp — Milestone Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan mức milestone.** Contract ở đây là chốt; trước mỗi milestone chạy `superpowers:writing-plans`
> để viết thành bước TDD có code. Phụ thuộc: `2026-10-05-meetings-p1-core.md` đã merge.
> Đây là phần thuộc **Module A** (AI) — điểm khác biệt của PON so với Meet/Teams.

**Goal:** Trong phòng họp có phụ đề trực tiếp ghi tên người nói; khi kết thúc có biên bản AI (tổng quan, ý chính, quyết định, action items) gộp từ transcript + ghi chú chung + chat; host duyệt action items thành nhắc việc cho từng người; gõ `@AI` trong chat họp để hỏi trợ lý với ngữ cảnh cuộc họp.

**Architecture:** Không có STT phía server (spec D6). Mỗi client tự chuyển giọng nói **của chính mic mình** thành chữ (tái dùng `use-call-transcriber` / `call_stt_service.dart`) và gửi đoạn đã chốt lên chat-service ⇒ mỗi đoạn có sẵn `userId` người nói. chat-service lưu Redis + phát phụ đề. Biên bản tái dùng đường `call:summarize` → ai-service bằng một kênh riêng cho cuộc họp; `@AI` trong chat họp đi qua hàng đợi RabbitMQ `ai.requests` sẵn có với ngữ cảnh cuộc họp.

**Tech Stack:** Spring Boot 3 · Redis pub/sub · RabbitMQ · NestJS ai-service (Anthropic SDK) · Web Speech API · `speech_to_text` (Flutter, đang dùng trong `call_stt_service.dart`).

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §3 D6, §4.4.

## Global Constraints

- Nhánh `feat/meetings-ai` cắt từ `origin/main` (sau khi P1 merge); test trên `dev` trước.
- **Minh bạch:** khi `settings.aiNotetaker = true`, **mọi** người trong phòng thấy chỉ báo "AI đang ghi chú" thường trực, và màn chờ báo trước khi vào. Không bật ngầm.
- Chỉ người tham dự / người được mời / host xem được transcript và biên bản; tuân RBAC của người hỏi khi trả lời `@AI`.
- Không hiện JSON thô hay lỗi model ra UI (`.claude/rules/no-raw-system-data-in-ui.md`); biên bản render có cấu trúc.
- Biên bản viết bằng ngôn ngữ chiếm đa số trong transcript (như `CallSummaryService` hiện tại).
- Đoạn transcript ≤ 500 ký tự; chat-service bỏ đoạn rỗng; giữ transcript trong Redis 24h sau khi họp kết thúc rồi xoá (biên bản là bản lưu lâu dài).
- Model: tái dùng cấu hình `config.anthropic.model` như `CallSummaryService`; tham số `effort` chỉ gửi cho model hỗ trợ (memory: `ai-effort-param-400`).
- i18n 7 locale; file UI ≤ 400 dòng, service ≤ 500 dòng.

## Review Focus

1. **Trình duyệt không có Web Speech API (Firefox)** — người đó vẫn họp bình thường, nút phụ đề của họ báo "Trình duyệt này không hỗ trợ phụ đề"; người khác vẫn thấy phụ đề của những người có STT.
2. **Cuộc họp không có transcript và ghi chú trống** — không gọi model, trang chi tiết ghi "Không đủ nội dung để tạo biên bản", không phải lỗi.
3. **Action item gán cho người không có mặt / không resolve được tên** — vẫn tạo được, người nhận để trống cho host chọn; không bao giờ hiện userId.
4. **`@AI` hỏi về thứ người hỏi không có quyền** (KB phòng ban khác, ngữ cảnh Confidential) — trả lời theo quyền người hỏi, không theo quyền host.
5. **ai-service chết lúc kết thúc họp** — yêu cầu biên bản không mất: nút "Tạo lại biên bản" trên trang chi tiết cho host.

---

## Contract

### STOMP / Redis

| Hướng | Kênh | Payload |
|---|---|---|
| C→S | `/app/meet.transcript` | `{meetingId, text, ts}` — chỉ khi đang ở trong phòng và `aiNotetaker` hoặc phụ đề đang bật |
| S (Redis) | `meet:transcript:{id}` | list JSON `{userId, displayName, text, ts}` (giống `call:transcript:*`) |
| S→C | `/topic/meeting/{id}` | `meet.caption {userId, displayName, text, ts}` |
| S→ai | Redis pub `meet:summarize` | `{meetingId}` |
| ai→S | Redis pub `meet:summary:result` | `{meetingId, summary: MeetingSummary}` |
| S→C | `/topic/meeting/{id}` và `/user/queue/meeting` | `meet.summary.ready {meetingId}` |

```ts
// ai-service → chat-service
interface MeetingSummary {
  attendees: string[];            // tên hiển thị
  durationSec: number;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: { text: string; assigneeId: string | null; dueAt: string | null }[];  // assigneeId ∈ người tham dự, hoặc null
}
```

chat-service lưu vào collection `meeting_summaries` `{meetingId, summary, generatedAt, actionItemsApplied: boolean}` và gán `Meeting.summaryId`.

### REST (thêm vào `/api/meetings`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/{id}/summary` | 404 khi chưa có |
| POST | `/{id}/summary/regenerate` | host/co-host; publish lại `meet:summarize` |
| POST | `/{id}/summary/action-items/apply` | host/co-host; body `[{text, assigneeId, dueAt}]` (đã chỉnh) ⇒ tạo `Reminder` cho từng người (collection `reminders` sẵn có, `ReminderSweepService` sẽ giao) |
| GET | `/{id}/transcript` | người tham dự / được mời; chỉ trong 24h |

### `@AI` trong chat họp

- chat-service: tin `meet.chat` khớp regex `(?i)@(AI|ponai)\b` ⇒ publish `ai.requests` với `conversationId = "meeting:{id}"`, `userId` = người hỏi, `history` = 20 tin chat họp gần nhất, cộng trường mới `meetingContext: {title, notesExcerpt (≤ 4000 ký tự), transcriptTail (≤ 60 đoạn gần nhất)}`.
- ai-service: `AiRequestPayload` thêm `meetingContext?`; khi có thì thêm khối "Cuộc họp hiện tại" vào system prompt; các tool giữ nguyên quyền theo `userId` người hỏi.
- Trả lời stream qua `ai:response:meeting:{id}` như hội thoại thường; chat-service lưu thành `MeetingMessage` với `senderId = AiConstants.AI_BOT_USER_ID` và phát `meet.chat`.

---

## Milestones

### AI1 — Thu transcript & phụ đề (chat-service + 2 client)

- chat-service: `service/meeting/MeetingTranscriptService.java` (+ `@MessageMapping("/meet.transcript")` trong `MeetingWsController`), kiểm người gửi đang trong phòng, cắt 500 ký tự, RPUSH + TTL, phát `meet.caption`. Test: người ngoài phòng bị bỏ qua; đoạn rỗng bị bỏ; TTL được đặt.
- Web: hook `use-meeting-captions.ts` dùng lại `use-call-transcriber` cho mic của mình; `CaptionsOverlay.tsx` (2 dòng gần nhất, tên người nói); nút CC trong `ControlBar`; chỉ báo "AI đang ghi chú".
- Flutter: mirror bằng `call_stt_service.dart`; `captions_overlay.dart`; nút CC; chỉ báo.
- Settings: host bật/tắt `aiNotetaker` trong phòng (thêm action `AI_NOTETAKER_ON|OFF` vào `/app/meet.host`) — phát `meet.settings`, client hiện/ẩn chỉ báo.

### AI2 — Biên bản (ai-service + chat-service)

- ai-service: `src/meeting/meeting-summary.service.ts` (tách từ cách làm của `call/call-summary.service.ts`: load transcript, resolve tên, gộp **ghi chú chung** + **chat họp** vào prompt, xuất `MeetingSummary` JSON có `decisions` và `actionItems` dạng object), `meeting-subscriber.service.ts` (kênh `meet:summarize`), module mới đăng ký trong `app.module.ts`. Test: transcript rỗng + ghi chú rỗng ⇒ không gọi model; JSON hỏng ⇒ không publish, log lỗi; `assigneeId` không thuộc người tham dự ⇒ `null`.
- chat-service: khi `MeetingRtcHandler` chuyển ENDED (hoặc host `end`) và `aiNotetaker` ⇒ publish `meet:summarize`; listener `meet:summary:result` ⇒ lưu `meeting_summaries`, phát `meet.summary.ready`; REST `summary`, `regenerate`, `transcript`. Test idempotent (kết thúc 2 lần chỉ publish 1 lần — claim bằng update có điều kiện).

### AI3 — Action items → nhắc việc

- chat-service: `POST /{id}/summary/action-items/apply` tạo `Reminder` cho từng `assigneeId` (bỏ qua item không có người nhận), set `actionItemsApplied`, gửi thông báo cho người được giao. Test: chỉ host/co-host; gọi lại không tạo trùng.
- Web + Flutter: khối "Biên bản AI" trên trang chi tiết (tổng quan, ý chính, quyết định, action items có ô chọn người + hạn); host sửa rồi bấm **Tạo nhắc việc**; nút **Tạo lại biên bản**.

### AI4 — `@AI` trong chat họp

- chat-service: nhận diện mention trong `MeetingChatService`, publish `ai.requests` với `meetingContext`, nhận stream `ai:response:meeting:{id}` (mở rộng `AiResponseListener` để phân biệt `meeting:` prefix), lưu + phát như tin chat họp. Test: không mention ⇒ không publish; người hỏi không trong phòng ⇒ bỏ qua.
- ai-service: `meetingContext` trong payload + prompt builder; test prompt có khối cuộc họp, tool vẫn theo `userId` người hỏi.
- Web + Flutter: tin AI trong `MeetingChatPanel` / `meeting_chat_sheet.dart` render Markdown, trạng thái đang trả lời (stream).

### AI5 — QC

- [ ] `sync-check` web ↔ Flutter.
- [ ] Ma trận: họp 3 người tiếng Việt + 1 người nói tiếng Anh (phụ đề đúng người, biên bản viết tiếng Việt); Firefox không STT; tắt/bật notetaker giữa họp; kết thúc ⇒ biên bản ≤ 60s; action items → nhắc việc tới đúng người đúng giờ; `@AI` hỏi "nãy giờ đã chốt gì?" trả lời từ transcript; `@AI` hỏi KB phòng ban khác bị từ chối theo quyền; tắt ai-service lúc kết thúc ⇒ "Tạo lại biên bản" chạy được khi bật lại.
- [ ] Cập nhật `docs/api-spec.md`, `.claude/rules/ai-service.md` (kênh mới), `docs/superpowers/plans/README.md`, báo cáo Module A.
