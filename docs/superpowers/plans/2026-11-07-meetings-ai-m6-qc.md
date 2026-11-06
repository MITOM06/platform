# Meetings AI — M6 QC (checklist thử tay + kết quả soát tự động)

> M6 của `2026-11-05-meetings-ai.md`. Phần tự động (sync-check web ↔ Flutter, soát hợp đồng
> chat-service ↔ ai-service, full suite, docs) chạy trên `feat/meetings-ai`. Phần thử tay chạy
> trên `dev` sau khi owner đồng ý merge — **chưa merge `main`** cho tới khi checklist dưới xanh.

## Chuẩn bị

- Merge `feat/meetings-ai` → `dev`, deploy/chạy stack (chat-service, ai-service, auth, web, Redis, Mongo, LiveKit, Caddy).
- ai-service có `ANTHROPIC_API_KEY`; hai service cùng `INTERNAL_API_KEY`.
- 4 tài khoản: **H** (host), **A** (được mời, dự họp), **V** (được mời, vắng), **X** (người ngoài).
- Thiết bị: Chrome desktop, Firefox desktop, Safari, Android thật (bản build mới), iPhone thật (bản build mới).

## Checklist (đánh dấu khi xanh)

### M1 — Ghi chú AI
- [ ] H tạo họp có AI trên web, vào bằng Chrome; A vào bằng Android. Nói vài câu mỗi bên ⇒ `meeting_records` có đoạn của **cả hai**, đúng tên.
- [ ] Bật AI **giữa buổi** (họp tạo không có AI) ⇒ mọi người thấy chỉ báo AI, từ lúc đó có record.
- [ ] H tắt AI ⇒ không thêm đoạn mới. Tạm dừng của riêng mình ⇒ chỉ mình mình ngừng.
- [ ] Firefox / iPhone vào ⇒ thấy "không hỗ trợ" (nếu nền tảng không có STT), họp bình thường.

### M2 — Tóm tắt + nhóm sau họp
- [ ] Kết thúc họp ⇒ trong ~1 phút trang chi tiết có "Tóm tắt AI"; nhóm cuộc họp được tạo gồm H, A, V (không gồm X, không gồm bot), tin `meeting_summary` trong nhóm; V nhận push.
- [ ] Họp chỉ 1 người ⇒ có tóm tắt, **không** tạo nhóm.
- [ ] Tắt ai-service ngay trước khi kết thúc ⇒ sau ~10' trạng thái `FAILED` ⇒ bật lại ai-service ⇒ H bấm "Tạo lại" ⇒ READY, **không** tạo nhóm thứ hai.
- [ ] A (không phải host/co-host) không thấy nút "Tạo lại".
- [ ] Qua Caddy: `curl` `/api/chat/internal/...`, `%69nternal`, `//internal`, `/Internal` ⇒ đều 404.

### M3 — Hỏi AI
- [ ] `@AI ai nói gì về X?` trong chat họp ⇒ cả phòng thấy trạng thái đang trả lời rồi câu trả lời Markdown.
- [ ] `@AI` trong phòng có khách được duyệt từ phòng chờ.
- [ ] `@AI /new` trong phòng ⇒ coi như câu hỏi thường.
- [ ] `@AI` trong nhóm sau họp ⇒ trả lời đúng nội dung họp.
- [ ] **V** (vắng) chat 1-1 với AI: "cuộc họp … chốt gì" ⇒ trả lời được.
- [ ] **X** hỏi cùng câu ⇒ "không tìm thấy", không lộ nội dung.
- [ ] Câu trả lời AI có ảnh/link ⇒ không tải ảnh, link không bấm được.

### M4 — File trong chat họp
- [ ] Gửi PDF, DOCX, ảnh slide (web + Android) ⇒ card file trong chat; `meeting_records` có dòng FILE; tóm tắt có mục "Từ tài liệu".
- [ ] Gửi `.pptx` ⇒ dòng "Không đọc được file này.".
- [ ] File > 20 MB ⇒ bị chặn trước khi upload, báo lỗi.
- [ ] Mất mạng ngay sau khi upload ⇒ file giữ lại, gửi lại được.
- [ ] `UPLOADS_REQUIRE_AUTH=true`: X mở link file ⇒ 403.
- [ ] Độ tương phản card file (sáng/tối).

### M5 — Màn hình share
- [ ] Share slide trên Chrome ⇒ chip "AI đang đọc màn hình" ⇒ record có dòng `[SCREEN]`.
- [ ] Share trên **Android thật** ⇒ `captureFrame` chạy, có dòng `[SCREEN]`.
- [ ] Safari / Firefox share ⇒ hoặc chạy, hoặc chip không hiện (không lỗi).
- [ ] Màn hình đứng yên ⇒ không gửi thêm ảnh. Share video ⇒ tối đa 1 ảnh / 15 s; hết 60 ảnh ⇒ dòng hệ thống báo đạt giới hạn.
- [ ] Vài phút sau khi họp, `db.fs.files.countDocuments({"metadata.screenFrame": true})` về 0.

### Chung
- [ ] App mobile **bản cũ** vào họp có AI ⇒ họp bình thường (biết: không thấy chỉ báo AI).
- [ ] Đổi ngôn ngữ (vi / en + 1 locale khác) trên web + app ⇒ không lộ key i18n ở các màn trên.

## Quyết định owner phải chốt trước `main`

1. Chi phí vision (ảnh file M4 + ảnh màn hình M5) tính vào quota **người gửi** (hiện tại) hay **bot AI**.
2. `UPLOADS_REQUIRE_AUTH` trên prod: bật hay tắt.
3. Tên người bị đá có nằm trong danh sách tham dự của tin tóm tắt không (hiện: có).

## Kết quả soát tự động (2026-11-06)

- Full suite: chat-service 1102, ai-service 798, web 1292 (+ tsc, build), Flutter 1200 (+ analyze 0 issue) — xanh. `pnpm lint` ai-service hỏng do thiếu `eslint.config.*` (có từ trước trên `main`).
- Sync-check web ↔ Flutter: 8 lệch, đều thẩm mỹ, không lỗi người dùng. Đã sửa 7 cho Flutter giống web (`20394372`); vị trí dòng "PON AI đang trả lời…" giữ khác (mobile ghim trên ô soạn). i18n: 32/33 key mới đủ 7 locale.
- Soát hợp đồng chat-service ↔ ai-service: 0 lệch gây lỗi. `@AI` trống trong chat họp không gửi AI nữa (`10662ffd`). Thêm fixture dùng chung `meeting-record.internal.json` + `meet-summary-result.ok.json`, hai bên cùng test (`9d939c27`). Docs (`3f077ffe`).
- Review lượt sửa: APPROVED, 5 Minor.

Việc để sau (không chặn merge):
- `@AI` trống trong chat thường/nhóm (kể cả nhóm sau họp) vẫn gửi nội dung rỗng sang ai-service — có từ trước, sửa sẽ đổi hành vi mọi chat ⇒ owner quyết.
- chat-service `non_null` bỏ trường null khỏi JSON nội bộ (kể cả `assigneeName` trong summary): ai-service đã xử lý, type để optional; đừng viết `=== null`.
- `compose.yml` / `compose.prod.yml` không bắt buộc `INTERNAL_API_KEY` (chỉ `compose.mini.yml` bắt buộc): thiếu ⇒ mọi tóm tắt `FAILED`.
- Link trong câu trả lời AI trên Flutter vẫn được trình đọc màn hình đọc là "link".
- Còn 7 kênh/endpoint chưa có fixture dùng chung (`meet:summarize`, `meet:material` file/screen, `meet:material:result` file, `ai.requests` họp, `ai:response:meeting:*`, `GET /internal/meetings`).
