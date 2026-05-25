# AI_WORKFLOW.md — Vòng Lặp Bán Tự Động

## Phân vai

| Agent | Tool | Nhiệm vụ |
|-------|------|----------|
| **Gemini 2.0 Pro** | VS Code Extension (Enterprise) | **Planner + QC** — Đọc .md files → viết spec → review kết quả của Claude |
| **Claude** | CLI Terminal (`claude`) | **Coder + Tester** — Đọc spec → viết code toàn bộ layer → tự chạy build/test/fix |
| **Tech Lead** | VS Code | **Cầu nối + Phê duyệt** — Quyết định feature, chuyển thông tin giữa 2 AI |

---

## Vòng lặp đầy đủ

```
① IDENTIFY → ② GEMINI SPEC → ③ CLAUDE CODE → ④ GEMINI QC → ⑤ REPORT
                                     ↑________________________|
                                        (nếu fail: Claude fix)
```

---

## BƯỚC ① — Xác định thiếu sót

**Cách 1 — Hỏi Claude:**
> "Claude, dự án PON hiện tại còn thiếu gì để đạt mức production-ready?"

**Cách 2 — Tự test trên giao diện:**
Chạy app → thấy tính năng nào chưa có / lỗi → note lại tên feature.

---

## BƯỚC ② — Gemini viết Spec vào TODO.md

**Prompt cho Gemini** (paste vào VS Code Extension):
```
Đọc các file sau để nắm context dự án (tiết kiệm token, đừng đọc toàn bộ repo):
- CLAUDE.md
- apps/server/chat-service/CLAUDE.md
- apps/client/CLAUDE.md
- .claude/ai-activity.md  (xem session gần nhất để biết đã làm gì)
- docs/api-spec.md
- TODO.md  (xem sprint hiện tại)

Sau khi đọc xong, viết spec kỹ thuật đầy đủ cho feature: [TÊN FEATURE]
vào TODO.md, mục "## SPRINT X — [tên feature]", theo đúng cấu trúc template:

### TASK [N] — [tên task] `PENDING`
#### SPEC
- **Data model:** (schema, fields mới nếu có)
- **Backend:** (file path, class, method, logic cụ thể)
- **Frontend:** (file path, widget/screen, Riverpod provider, API call)
- **Test:** (mvn test case / flutter test case cần pass)
```

→ Tech Lead **review spec**, chốt, rồi qua bước 3.

---

## BƯỚC ③ — Claude implement toàn bộ

**Prompt cho Claude** (gõ vào Terminal):
```
Đọc TODO.md, implement TASK [N]: [tên task].
Viết đủ tất cả layer theo spec (data → BE → FE).
Sau khi viết xong, tự chạy: mvn clean compile && mvn test (cho BE)
hoặc flutter analyze && flutter test (cho FE).
Fix tất cả lỗi cho đến khi BUILD SUCCESS / No issues.
Ghi kết quả vào mục QA LOG của TODO.md.
```

→ Claude tự loop trong terminal cho đến khi pass, không cần theo dõi.

---

## BƯỚC ④ — Gemini QC

**Prompt cho Gemini** (sau khi Claude báo xong):
```
Claude vừa implement xong TASK [N]. Đọc lại TODO.md (mục QA LOG)
và các file code sau để review:
- [danh sách file Claude vừa viết — Claude sẽ báo]

Đánh giá:
1. Code có đúng spec không?
2. Có bug logic / security gap / missing edge case nào không?
3. Nếu cần fix: viết rõ instruction vào TODO.md mục "## FIX NOTES"
4. Nếu pass: ghi "✅ QC PASS" vào TODO.md và báo Tech Lead
```

---

## BƯỚC ⑤ — Nếu Gemini yêu cầu fix

**Prompt cho Claude:**
```
Đọc TODO.md mục "## FIX NOTES" từ Gemini, fix theo đúng instruction.
Sau khi fix, chạy lại test và cập nhật QA LOG.
```

→ Lặp lại bước ④ → ⑤ cho đến khi Gemini ghi "✅ QC PASS".

---

## Cấu trúc TODO.md cho mỗi Sprint

```markdown
## 🔴 SPRINT X — [Tên feature] — IN PROGRESS

### TASK N — [tên] `PENDING / IN_PROGRESS / DONE`
#### SPEC         ← Gemini viết
#### FIX NOTES    ← Gemini viết khi QC fail
#### IMPL NOTES   ← Claude ghi khi code xong

## 🧪 QA LOG
[timestamp] mvn test → ...
[timestamp] Gemini QC → PASS / FAIL + lý do
```

---

## Nguyên tắc tiết kiệm token

- Gemini **không cần đọc toàn bộ repo** — chỉ đọc 5 file .md là đủ context
- Claude **không cần đọc lịch sử chat** — chỉ đọc `TODO.md` là đủ nhiệm vụ
- `ai-activity.md` là memory duy nhất giữa các session — luôn append vào đó sau mỗi sprint
