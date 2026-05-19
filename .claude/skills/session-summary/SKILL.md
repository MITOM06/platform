---
name: session-summary
description: Ghi tóm tắt session hiện tại vào ai-activity.md. Gọi khi sắp kết thúc session hoặc trước khi /clear
---

Dựa trên những gì đã làm trong session này, hãy append một session summary vào `.claude/ai-activity.md` theo format:

---

## Session: [DATE YYYY-MM-DD] — [ONE LINE TITLE]

**Tóm tắt:** [2-3 câu mô tả]

**Files tạo/sửa:**
- `path/to/file` — [lý do]

**Quyết định:**
- [Quyết định kỹ thuật]

**Kết quả:**
- ✅ [Hoàn thành]
- ❌ [Chưa xong / bị block]

**Next:** [Task cụ thể tiếp theo]

---

Sau khi append xong, đọc lại và confirm với user.
