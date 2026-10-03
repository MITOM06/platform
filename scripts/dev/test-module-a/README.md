# Module A — bộ test E2E (A1 → A6)

Test end-to-end cho **Module A — AI Assistant, Memory & RAG** theo bảng task
A1–A6 trong *PON-Giai-doan-3-Phan-cong-Hoan-thien*. Chạy trên stack local thật:
Anthropic, Voyage, Qdrant, RabbitMQ và Redis đều chạy thật, không dùng mock.

Mỗi case in ra theo cùng một mẫu:

```
━━ A2.3  AI trả lời từ KB và trích dẫn nguồn
  Tài khoản : dev@pon.local / Devpass123!
  Các bước  : 1. …
  Kỳ vọng   : …
  Thực tế   : …            ← output thật của hệ thống
  Kết quả   : ✅ PASS | ❌ FAIL | ⏭ SKIP | 📝 MANUAL
  Cách xử lý: …            ← chỉ in khi FAIL: file/log cần xem
```

Cuối lượt chạy có bảng tổng kết. Báo cáo markdown được ghi ra `.dev-logs/module-a-report-<RUN>.md`.

## Chạy

```bash
./scripts/dev/up.sh                               # stack đang chạy (thêm --build nếu vừa kéo code)
node scripts/dev/seed-company/index.js            # dữ liệu công ty ảo NovaTech
node scripts/dev/test-module-a/index.js           # toàn bộ A1–A6, khoảng 4–6 phút
node scripts/dev/test-module-a/index.js --only A2,A5
node scripts/dev/test-module-a/index.js --keep    # giữ lại nhóm "[TEST-A] …" để mở trên UI xem
```

- **Mã thoát:** `0` khi không có FAIL, `1` khi có FAIL, `2` khi thiếu điều kiện chạy (service chưa chạy, chưa seed).
- **Mã RUN:** mỗi lượt chạy sinh một mã riêng (vd `ZKVG4`) và nhúng vào mọi file, câu hỏi, biển số…. Vì vậy AI chỉ trả lời đúng khi thật sự đọc dữ liệu của lượt đó.
- **Dọn dẹp:** sau khi chạy, script tự xoá nhóm test, tài liệu KB (kể cả vector trong Qdrant), reminder, transcript và các key Redis.
- **Fact trong trí nhớ dài hạn:** fact AI tự lưu (vd biển số `51K-<RUN>`) **vẫn được giữ lại**. Mỗi lượt dùng mã RUN khác nên không ảnh hưởng lượt sau.

### Daily digest (A4.5) — phải chờ tới phút :00

Digest chạy theo cron mỗi giờ, và giờ trong container ai-service là **UTC**.

```bash
node scripts/dev/test-module-a/index.js --digest-setup   # đặt giờ digest = giờ kế tiếp, in ra giờ VN cần chờ
node scripts/dev/test-module-a/index.js --digest-check   # chạy sau giờ đó vài phút; tự khôi phục cấu hình cũ
```

## Tài khoản

Mật khẩu chung: **`Devpass123!`**.

| Tài khoản | Vai trò | Phòng ban | Dùng ở |
|---|---|---|---|
| `dev@pon.local` | Owner (Tech Lead) | Kỹ thuật, Ban GĐ | A1, A2, A4, A5.3–A5.4, A6.1 — tài khoản chính |
| `alice@pon.local` | Member | Kỹ thuật | Thành viên nhóm test, A3.4 |
| `quan.nguyen@novatech.local` | Owner (CEO) | Ban GĐ | A3.1, A3.5 (cấu hình AI workspace), A6.2 (dashboard admin) |
| `nam.le@novatech.local` | Manager | Kỹ thuật | A3.1 (thấy mục nội bộ, không thấy mục mật) |
| `son.ho@novatech.local` | Member | Kinh doanh | A3.1, A3.6, A3.7, A5.7, A6.3 |
| `lan.vo@novatech.local` | Member | Kỹ thuật | A5.5, A5.6 (không được đọc KB của phòng Kinh doanh) |
| `minh.phan@novatech.local` | Member | Marketing | A5.1 (rate limit) |
| `thu.ta@novatech.local` | Member | Tài chính | A5.2 (quota tháng) |

## Danh sách case

| Mã | Kiểm tra | Loại |
|---|---|---|
| A1.1 | Chat 1-1 với AI: có streaming (≥2 chunk, chunk đầu < 15s) | tự động |
| A1.2 | Trong nhóm, AI chỉ trả lời khi có `@AI` | tự động |
| A1.3 / A1.4 | Nhớ ngắn hạn trong phiên; sau `/new` thì quên | tự động |
| A1.5 | Lượt thứ 3 tự rút trích fact, fact được nhớ sang hội thoại khác | tự động |
| A1.6 | API màn hình Memory: xem / xoá / 404 sau khi xoá | tự động |
| A1.7 | Fallback sang model dự phòng | thủ công (unit test) |
| A2.1–A2.5 | KB với TXT/PDF: chunk, embedding, trả lời kèm `[Source]`, câu hỏi diễn đạt khác | tự động |
| A2.6 | Agent Trace có model / token / thời gian | tự động |
| A2.7–A2.10 | Tool `search_messages`, `summarize_conversation`, `get_user_info`, `search_knowledge_base` (kiểm tra cả kết quả trả về của tool) | tự động |
| A3.1 | AI Context theo vai trò (Owner / Manager / Member, theo phòng ban) | tự động |
| A3.2 | Lưu Response Style cá nhân | tự động |
| A3.3 / A3.4 | Persona theo hội thoại có hiệu lực ngay; người không phải admin nhận 403 | tự động |
| A3.5 / A3.6 | Cấu hình AI cấp workspace có hiệu lực ngay; Member nhận 403 | tự động |
| A3.7 | AI trả lời đúng theo vai trò và không lộ mục mật | tự động |
| A3.8 | AI Hub trên web và mobile | thủ công |
| A4.1 / A4.2 | Vision: đọc ảnh trong chat; đọc PDF scan trong KB | tự động |
| A4.3 | AI tạo reminder qua tool, đúng thời gian | tự động |
| A4.4 | AI notetaker tạo biên bản họp | tự động |
| A4.5 | Daily digest | 2 bước (`--digest-setup` / `--digest-check`) |
| A5.1 / A5.2 | Rate limit (`AI_RATE_LIMITED`) và quota tháng (`AI_QUOTA_EXCEEDED`) | tự động |
| A5.3 / A5.4 | Prompt injection trực tiếp và gián tiếp qua KB | tự động |
| A5.5–A5.7 | KB phòng ban: không tạo được nhóm thuộc phòng khác, không lộ KB, phòng mình vẫn đọc được | tự động |
| A6.1–A6.3 | Usage cá nhân hôm nay; dashboard admin khớp số; Member nhận 403 | tự động |
| A6.4 | Màn hình usage web = mobile | thủ công |

## Kiểm tra tay trên giao diện

Web: http://localhost:3000. Mobile: `./scripts/dev/up.sh --phone` hoặc `--flutter`.

Chạy bộ test với `--keep` trước để có sẵn nhóm `[TEST-A] <RUN>` chứa dữ liệu.

1. **A1.** Đăng nhập `dev@pon.local` → AI Hub → *Chat với PON AI*.
   - Chữ phải hiện dần (streaming), không bật ra cả khối một lúc.
   - Cài đặt → AI Memory: thấy fact "Biển số xe máy: 51K-…"; bấm xoá thì fact biến mất trên **cả web lẫn mobile**.
2. **A2.** Mở nhóm `[TEST-A]`.
   - Câu trả lời có chip trích dẫn `[Source 1]`; bấm vào chip mở đúng file.
   - Bấm "Xem trace" thấy tool, token, thời gian.
   - Sau khi reload trang, chip trích dẫn vẫn còn (lỗi cũ 1c: mất chip).
3. **A3.** Cài đặt nhóm → AI Persona.
   - Đổi tên/tone xong, lượt hỏi kế tiếp có hiệu lực ngay.
   - Đăng nhập `quan.nguyen@novatech.local` → Admin → AI / AI Context; đăng nhập `son.ho@novatech.local` thì **không thấy** mục Admin.
4. **A4.**
   - Gửi một ảnh có chữ rồi hỏi AI nội dung ảnh.
   - Màn hình Reminders có nhắc nhở do AI tạo; tới giờ phải nhận thông báo.
   - Tin "Biên bản họp" hiển thị dạng thẻ, không phải JSON thô.
5. **A6.** Màn hình Token usage của `dev` (web và mobile, 7 ngày) và `/admin/usage` của `quan` hiển thị cùng con số.

## Kết quả lượt chạy 03/10/2026

**34 PASS / 3 FAIL / 4 MANUAL.** Cả 3 FAIL đều là lỗi thật:

| Case | Lỗi | Nguyên nhân / nơi sửa |
|---|---|---|
| A2.3 | Câu hỏi gần như trùng văn bản vẫn trả lời "không có thông tin", `sources=[]` | Điểm tương đồng của voyage-4-lite thấp hơn `kb.scoreThreshold = 0.5` nên RAG bị chặn (`context-builder.service.ts`). Kết quả không ổn định: A2.4 với câu hỏi khác lại qua. |
| A2.7 | AI hiện **ID người dùng thô** (`6ac0…`) thay vì tên | `search-messages.tool.ts` tra `users` bằng `_id` dạng string, trong khi `_id` là ObjectId nên không khớp và rơi về ID thô. Vi phạm `no-raw-system-data-in-ui` (P1). |
| A2.9 | Tool `get_user_info` luôn trả "User not found" | Cùng lỗi: `get-user-info.tool.ts` dùng `findOne({ _id: ctx.userId })` với string. |
