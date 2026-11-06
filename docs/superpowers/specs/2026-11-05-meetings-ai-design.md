# Phòng họp — AI ghi chú, nhóm sau họp, hỏi AI về cuộc họp — Design

> Ngày: 2026-11-05 · Owner: Tran Phuc Khang · Trạng thái: **DRAFT — chờ owner duyệt** (đã qua builder check)
> Thay thế milestone plan `docs/superpowers/plans/2026-10-05-meetings-p2-ai.md` (viết trước khi
> chuyển LiveKit Cloud + Claude sub; khác về đầu vào và về nơi giao kết quả).
> Phụ thuộc: Meetings P1 (đã trên `main`). Spec gốc: `2026-10-05-calls-and-meetings-design.md` (D6).

Ký hiệu: **[Owner]** = owner đã chốt trong buổi brainstorm 2026-11-05. **[Claude]** = quyết định của
Claude, owner có thể đổi khi duyệt. Không ghi gì = hệ quả trực tiếp của hai loại trên.

---

## 1. Ý định

Họp xong, không ai phải ngồi viết biên bản, và người vắng mặt vẫn nắm được cuộc họp. AI "dự họp"
cùng mọi người: nghe nội dung, đọc file và màn hình được chia sẻ. Kết thúc họp, AI tự lập một nhóm chat
cho những người liên quan, đăng tóm tắt vào đó. Ai cũng có thể hỏi tiếp AI về cuộc họp, trong nhóm
hoặc trong chat riêng với AI.

Đây là điểm khác biệt của PON so với Meet/Teams (Module A) và là phần demo chính của đồ án.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
1. **[Owner]** Người tạo cuộc họp bật/tắt "AI ghi chú" ngay trên form tạo/lên lịch.
2. **[Owner]** Khi bật, AI ghi nhận suốt buổi họp từ 4 nguồn: lời nói, **file đính kèm trong chat họp**,
   **màn hình đang share**, chat họp. **[Claude]** Thêm nguồn thứ 5: ghi chú chung của cuộc họp (P1 đã có).
3. **[Owner]** Trong lúc họp, gõ `@AI` trong chat họp thì AI trả lời ngay trong chat họp đó, chỉ người
   trong phòng thấy.
4. **[Owner]** Kết thúc họp, AI tạo **nhóm chat** gồm *người thực sự vào họp* ∪ *người được mời nhưng vắng*,
   rồi đăng **tóm tắt** vào nhóm.
5. **[Owner]** Trong nhóm đó, thành viên `@AI` hỏi tiếp về cuộc họp.
6. **[Owner]** Thành viên của nhóm đó (mục 4) chat riêng 1-1 với AI và hỏi về cuộc họp.

**Không làm (bản này)**
- **[Claude]** Phụ đề trực tiếp trên màn hình họp. Transcript vẫn được thu, chỉ không hiển thị live.
- **[Claude]** Tự tạo nhắc việc từ action items. Action items chỉ nằm trong tóm tắt dưới dạng chữ.
- **[Owner, hướng A]** STT phía server / bot dự họp (LiveKit Agents). Không thêm dịch vụ STT trả phí.
- Ghi âm/ghi hình cuộc họp.
- Share màn hình từ iOS (P1 chưa hỗ trợ, `screen_capture.dart:28`).
- File `.pptx` / `.xlsx` (bộ trích xuất KB chưa hỗ trợ). Người dùng xuất PDF.

**Không được xảy ra** (sai ở đây thì tính năng hỏng, dù vẫn "chạy")
- AI ghi nhận ngầm: bật AI mà có người trong phòng không biết.
- AI trả lời nội dung cuộc họp cho người **không** thuộc cuộc họp đó, kể cả qua chat riêng 1-1.
- Hiện JSON thô, userId, URL nội bộ hay lỗi model ra UI (`.claude/rules/no-raw-system-data-in-ui.md`).
- Kết thúc họp mà không có tóm tắt, không có lý do, và không có cách tạo lại.
- Đốt hết quota gói Claude sub vì ảnh màn hình share không giới hạn.

## 3. Ràng buộc

- **[Owner] Hướng A:** mỗi client tự chuyển lời nói **của chính mic mình** thành chữ (web: Web Speech API
  qua `use-call-transcriber.ts`; Flutter: `call_stt_service.dart`). Client đang share thì tự chụp khung hình.
  Mỗi đoạn tự mang `userId` người nói.
- **Giới hạn đã biết của hướng A** (owner đã chấp nhận, ghi thành limitation, không phải bug):
  Firefox không có STT. iOS nhận dạng theo từng lượt, phải khởi động lại liên tục và dừng khi app xuống nền.
  Người không cấp quyền nhận dạng giọng nói thì phần lời của họ trống. Chất lượng phụ thuộc mic và tiếng ồn.
- LLM: văn bản (tóm tắt, `@AI`) đi qua provider hiện tại (`claude-cli` → fallback API).
  **Ảnh (vision) chỉ đi qua Anthropic API**: `claude-cli.client.ts:147` biến ảnh thành `'[ảnh]'`.
  ⇒ ảnh màn hình share và ảnh đính kèm **tốn tiền API thật**.
- Single-tenant, RBAC hiện có. AI luôn chạy theo quyền **người hỏi**.
- Web ↔ Flutter đồng bộ (`.claude/rules/sync.md`), i18n 7 locale, UI ≤ 400 dòng/file, service ≤ 500 dòng.
- Nhánh `feat/meetings-ai` cắt từ `main`. Test trên `dev` trước khi PR vào `main`.

## 4. Thiết kế

### 4.1 Công tắc & minh bạch
- `Meeting.Settings` thêm `aiNotes: boolean` (mặc định `false`). `MeetingSettingsDto` + form tạo/sửa trên web
  và Flutter có công tắc "AI ghi chú cuộc họp", kèm một dòng giải thích AI sẽ ghi nhận những gì.
- **[Claude]** Host/co-host đổi được khi đang họp (thêm lệnh vào `MeetingHostService`) → phát `meet.settings`.
- **[Claude]** Lưu thêm `aiNotesEverEnabled` (bật ít nhất một lần trong lúc họp). Chỉ ghi nội dung **trong lúc
  cờ đang bật**: tắt thì client dừng STT/chụp màn hình và server bỏ đoạn tới. Có tóm tắt khi `aiNotesEverEnabled`.
- **[Claude]** Bật **giữa buổi**: ngoài chỉ báo, mọi người đang trong phòng nhận một banner "AI bắt đầu ghi
  chú cuộc họp" (không bắt bấm đồng ý). Người vào muộn và người ở phòng chờ thấy thông báo ở màn chờ.
- Bật thì: màn chờ (pre-join) báo trước "Cuộc họp có AI ghi chú". Trong phòng có chỉ báo thường trực.
  Mỗi client tự bắt đầu/dừng STT theo cờ.
- **[Claude]** Mỗi người có nút "Tạm dừng ghi lời của tôi" (dừng STT của chính mình). Mic vẫn mở cho cuộc họp.

### 4.2 Thu nội dung trong lúc họp
Mọi thứ AI nhận được gọi chung là **bản ghi cuộc họp** (meeting record), lưu theo `meetingId`.

| Nguồn | Client làm gì | Server làm gì |
|---|---|---|
| Lời nói | STT mic mình, gửi đoạn đã chốt (≤ 500 ký tự) qua STOMP `/app/meet.transcript` | Kiểm người gửi đang trong phòng và `aiNotes` đang bật → append bản ghi |
| Chat họp | (sẵn có) | Tin chat họp được tính vào bản ghi khi build tóm tắt |
| Ghi chú chung | (sẵn có) | Lấy bản cuối khi build tóm tắt |
| File đính kèm | Chat họp thêm nút đính kèm (upload qua đường upload sẵn có) | `MeetingMessage` thêm `attachment {uploadId, name, mime, size}`; publish trích xuất nội dung (tái dùng `document-extractor` + `vision-describe`) → append bản ghi dạng "File: tên — nội dung/tóm lược" |
| Màn hình share | Máy đang share (web + Android) lấy khung hình từ track share **khi nội dung đổi đáng kể**, tối đa 1 ảnh/15 s, upload | ai-service vision mô tả (chữ trên slide, số liệu, ý chính) → append bản ghi dạng "Màn hình (hh:mm, người share)" → **xoá ảnh gốc** |

- **[Claude] Lưu trữ:** bản ghi lưu bền trong Mongo (`meeting_records`, mỗi đoạn `{meetingId, kind, userId,
  displayName, text, ts, ref?}`), không phải Redis 24h như plan cũ. Lý do: owner muốn hỏi AI về cuộc họp
  **sau này**, trong nhóm và chat riêng. Ảnh màn hình **không** lưu bền, chỉ giữ phần mô tả chữ.
  ⚠️ Hệ quả: lời nói cuộc họp được lưu dạng chữ vô thời hạn. Xoá cùng cuộc họp.
- **[Claude] Trần chi phí ảnh:** tối đa 60 ảnh màn hình mỗi cuộc họp (biến cấu hình). Hết trần thì ngừng
  chụp và ghi một dòng vào bản ghi. "Đổi đáng kể" do client tự phát hiện (so sánh ảnh thu nhỏ). Ngưỡng là
  việc của người code.
- File: giới hạn loại theo bộ trích xuất hiện có (PDF, DOCX, text, ảnh). Loại khác vẫn gửi được trong chat
  nhưng AI ghi "không đọc được file này".

### 4.3 `@AI` trong chat họp (lúc đang họp)
- `MeetingChatService` nhận diện `(?i)@(AI|ponai)\b` (cùng regex `ChatController.java:40`). Người gửi phải
  đang trong phòng.
- Publish `ai.requests` với `conversationId = "meeting:{id}"`, `userId` = người hỏi, `history` = 20 tin chat
  họp gần nhất, cùng trường mới `meetingId`. ai-service nạp bản ghi cuộc họp (§4.5) vào ngữ cảnh.
- Trả lời stream qua `ai:response:meeting:{id}` → chat-service lưu `MeetingMessage` với
  `senderId = AI_BOT_USER_ID` → phát `meet.chat`. Web + Flutter render Markdown + trạng thái đang trả lời.
- **[Claude]** `@AI` vẫn trả lời được khi `aiNotes` tắt, nhưng chỉ dựa trên chat họp + ghi chú chung
  (không có lời nói, file, màn hình).

### 4.4 Kết thúc họp → tóm tắt → nhóm
1. `MeetingCloser.close` (đường duy nhất tới ENDED khi họp thật sự diễn ra) và `aiNotes` đã từng bật
   → claim nguyên tử `summaryState: PENDING` (chỉ một lần) → publish `meet:summarize {meetingId}`.
   Cuộc họp bị huỷ/hết hạn mà chưa ai vào thì không tóm tắt.
2. ai-service `MeetingSummaryService`: đọc bản ghi + chat + ghi chú → nếu rỗng thì trả kết quả `empty`
   (không gọi model). Ngược lại sinh `MeetingSummary`:
   ```ts
   interface MeetingSummary {
     overview: string;
     keyPoints: string[];
     decisions: string[];
     actionItems: { text: string; assigneeName: string | null }[];
     fromMaterials: string[];   // ý quan trọng rút từ file + màn hình share
     language: string;          // ngôn ngữ chiếm đa số trong bản ghi
   }
   ```
   → publish `meet:summary:result {meetingId, status: ok|empty|failed, summary?}`.
3. chat-service nhận kết quả:
   - Lưu `meeting_summaries` + `Meeting.summaryState = DONE|EMPTY|FAILED`.
   - **Thành viên nhóm** = host + co-host + `inviteeIds` + mọi `attendance.userId` (bỏ trùng, bỏ bot, bỏ
     người đã bị đá `removedIds`). **[Owner]** Cuộc họp mời theo phòng ban (`departmentId`): **không** thêm
     cả phòng ban vào nhóm, chỉ người được mời đích danh + người thực sự vào họp. Thành viên phòng ban khác
     vẫn xem tóm tắt và hỏi AI được theo `canReadRecords` (§4.5), chỉ không được tự thêm vào nhóm.
   - Tạo nhóm qua một đường hệ thống (không qua REST): người tạo = host, tên = "Họp: {title}",
     `Conversation.meetingId = {id}`, lưu `Meeting.groupConversationId`. Ít hơn 2 thành viên thì không tạo
     nhóm (tóm tắt chỉ nằm ở trang chi tiết).
   - AI bot đăng tin tóm tắt vào nhóm, tái dùng loại tin `meeting_summary` (`AiMessageService.saveMeetingSummary`).
     **[Claude]** Card `meeting_summary` trên cả hai client mở rộng để đọc định dạng mới (`decisions`,
     `fromMaterials`, `actionItems` dạng object) **và vẫn đọc được định dạng cũ** của tóm tắt gọi nhóm
     (`actionItems` dạng string). Hiện `MeetingSummaryCard.tsx:16` bỏ âm thầm item không phải string.
   - Phát `meet.summary.ready` + thông báo (push) cho thành viên nhóm.
4. Trang chi tiết cuộc họp (web + Flutter) có khối "Tóm tắt AI", nút "Mở nhóm cuộc họp", và với host/co-host
   có nút **"Tạo lại tóm tắt"** khi `FAILED` (hoặc luôn có). **[Claude]** Tạo lại thì AI **đăng một tin
   tóm tắt mới** vào nhóm sẵn có (không sửa tin cũ, vì chưa có đường sửa tin AI), không tạo nhóm thứ hai.
   Nhóm chưa có (lần đầu `FAILED`) thì tạo lúc này.
5. **[Claude]** Kết thúc họp mà ai-service chết: `PENDING` quá 10 phút thì chuyển `FAILED` (sweep), trang
   chi tiết hiện "Chưa tạo được tóm tắt" + nút tạo lại.

### 4.5 Hỏi AI về cuộc họp sau đó
- **[Claude] Quyền xem một cuộc họp = `MeetingAccess.canReadRecords` sẵn có** (`MeetingAccess.java:116-125`:
  host, co-host, invitee, phòng ban, người đã vào, người được duyệt vào; trừ người bị đá). Cùng một luật với
  ghi chú/chat họp hiện tại, không đẻ luật thứ hai. Áp cho cả REST, tool AI và `@AI` trong nhóm.
- **[Claude] Luật chỉ có một bản, viết bằng Java:** ai-service **không** đọc thẳng `meeting_records`, mà gọi
  endpoint nội bộ của chat-service (`/internal/meetings/...?userId=`), để chat-service kiểm quyền rồi trả
  tóm tắt và đoạn bản ghi. Cơ chế xác thực service-to-service theo pattern nội bộ sẵn có (người code kiểm).
  Lý do: rủi ro lộ dữ liệu nằm ở luật quyền, và hai bản Java/TS sẽ lệch nhau.
- **Trong nhóm cuộc họp:** `@AI` đi qua đường group chat hiện có. Vì `Conversation.meetingId` có giá trị,
  ai-service tự nạp ngữ cảnh cuộc họp (tóm tắt + bản ghi) vào prompt.
- **Chat riêng 1-1 với AI:** thêm 2 tool vào `tool-registry.service.ts`, đọc Mongo trực tiếp như các tool
  hiện có:
  - `list_my_meetings({query?, from?, to?})`: các cuộc họp người hỏi có quyền xem, có tóm tắt.
  - `get_meeting_record({meetingId, question?})`: tóm tắt + các đoạn bản ghi liên quan (lọc theo `question`).
    Không có quyền thì trả "không tìm thấy" (không lộ là cuộc họp có tồn tại).
- **[Claude]** Bản ghi dài: chọn đoạn bằng tìm kiếm từ khoá trên bản ghi trong Mongo, chưa đưa vào Qdrant.
  Cuộc họp 1–2 giờ vẫn vừa ngữ cảnh khi kèm tóm tắt. Đổi sang vector search là việc về sau.

### 4.6 Contract tổng hợp

| Hướng | Kênh / Endpoint | Payload |
|---|---|---|
| C→S | STOMP `/app/meet.transcript` | `{meetingId, text, ts}` |
| C→S | `POST /api/meetings/{id}/screen-frames` (multipart) | ảnh JPEG ≤ 1280px cạnh dài + `ts` |
| S→ai | Redis `meet:material` | `{meetingId, kind: file\|screen, ref, userId, ts}` |
| ai→S | Redis `meet:material:result` | `{meetingId, kind, ref, text, ts}` |
| S→ai | Redis `meet:summarize` | `{meetingId}` |
| ai→S | Redis `meet:summary:result` | `{meetingId, status, summary?}` |
| S→C | `/topic/meeting/{id}` | `meet.settings`, `meet.chat` (thêm `attachment?`), `meet.summary.ready` |
| C↔S | `GET /api/meetings/{id}/summary`, `POST /{id}/summary/regenerate` | — |

Ai được gọi endpoint nào: `screen-frames` chỉ người đang share màn hình trong phòng đó. `summary` = quyền
xem cuộc họp (§4.5). `regenerate` = host/co-host.

## 5. Giai đoạn (mỗi giai đoạn demo được độc lập)

| GĐ | Nội dung | Demo được gì |
|---|---|---|
| **M1** | Công tắc + minh bạch + thu lời nói vào bản ghi | Bật AI khi tạo họp, thấy chỉ báo, lời nói vào DB |
| **M2** | Tóm tắt + nhóm sau họp + trang chi tiết + tạo lại | Họp xong → nhóm mới có tóm tắt của AI |
| **M3** | `@AI` trong chat họp, `@AI` trong nhóm cuộc họp, 2 tool cho chat riêng | Hỏi AI về cuộc họp ở cả 3 nơi |
| **M4** | Đính kèm file trong chat họp + trích xuất vào bản ghi | Gửi PDF trong họp → tóm tắt có ý từ PDF |
| **M5** | Chụp màn hình share + vision + trần chi phí | Share slide → tóm tắt có ý từ slide |
| **M6** | QC: `sync-check`, ma trận thiết bị thật, cập nhật docs | — |

Thứ tự M4/M5 đổi được. M5 rủi ro và tốn tiền nhất nên để cuối.

## 6. Để người code tự quyết
- Cách phát hiện "màn hình đổi đáng kể" và cách lấy khung hình từ track (web canvas, Flutter `captureFrame`).
- Tên lớp, chia file, prompt cụ thể cho tóm tắt và mô tả ảnh (theo `CallSummaryService` hiện có).
- Định dạng Markdown của tin tóm tắt trong nhóm, miễn render có cấu trúc trên cả hai client.
- Cách iOS khởi động lại STT cho mượt, trong khuôn khổ `speech_to_text`.

## 7. Rủi ro
- **Quota/chi phí:** vision đi API trả tiền. Tóm tắt + `@AI` dùng gói sub đang chia 3 bên. Trần ảnh (§4.2)
  là hàng rào chính.
- **Chất lượng transcript hướng A** thấp hơn STT server, nhất là iOS. Nếu demo lộ yếu, đường nâng cấp là
  bot dự họp (hướng B), không phải sửa vá client.
- **Riêng tư:** lời nói được lưu dạng chữ vô thời hạn và mọi thành viên nhóm (kể cả người vắng) đọc được
  qua AI. Phải nói rõ ở công tắc và màn chờ. Liên quan audit ATTT cấp độ 3 (log/lưu trữ dữ liệu cá nhân).

