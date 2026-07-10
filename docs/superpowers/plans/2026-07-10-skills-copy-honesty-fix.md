# Plan: Skills — Sửa copy sai sự thật + fix `requires` id mismatch (quick fix)

> **Ngày:** 2026-07-10
> **Scope:** Web (`apps/web/`) + Flutter (`apps/client/`) — chỉ copy/i18n + data mapping, KHÔNG đụng
> ai-service, KHÔNG đổi hành vi AI.
> **Đi kèm plan lớn:** `2026-07-10-skills-real-tool-wiring.md` (wire hành động thật cho 4 skill khả
> thi). Plan này làm NGAY để user không còn bị hiểu lầm trong lúc chờ plan lớn.

---

## Vấn đề

User bật skill (vd "Scheduler", "Project keeper") kỳ vọng AI thực sự đặt lịch / lưu note vào Notion
— nhưng skill hiện tại **chỉ là instruction chèn vào system prompt** (xem
`apps/server/ai-service/src/skills/skill-catalog.ts`), không gọi tool thật nào. Đây là thiết kế có
chủ đích (đã ghi rõ trong docstring của file), nhưng **copy hiển thị cho user lại mô tả như thể có
hành động thật**, gây hiểu lầm trực tiếp:

| Skill | Copy hiện tại (`messages/en.json`) | Vấn đề |
|---|---|---|
| `scheduler` | "**Books meetings**, finds slots, **sends invites** and reminders." | Không book, không send — chỉ đề xuất bằng lời |
| `researcher` | "**Searches the web** and your Drive, returns cited answers." | Không search web thật, không đọc Drive thật |
| `projectKeeper` | "**Files notes and tasks into Notion**, keeps databases tidy." | Không ghi gì vào Notion thật |
| `mailWriter` | "Drafts replies..." | Đây là copy ĐÚNG (chỉ soạn draft, không tự gửi) — giữ nguyên làm mẫu |

Ngoài ra, field `requires` (dùng để hiện hint "Needs: X" dưới mỗi skill) bị sai id ở CẢ 2 platform,
không khớp id thật trong catalog connector (`notion` / `gmail` / `calendar` / `drive`):

- Web `apps/web/lib/skills.ts`: `scheduler.requires = ['gcal', 'gmail']`, `researcher.requires =
  ['gdrive']` — catalog thật không có id `gcal`/`gdrive` (đúng phải là `calendar`/`drive`) → hint
  "Needs: Google Calendar" của scheduler bị rớt mất một nửa, hint của researcher biến mất hoàn toàn
  (silently filtered vì `catalogById.get('gdrive')` trả `undefined`).
- Flutter `apps/client/lib/features/skills/data/skill_defs.dart`: dùng `'google-calendar'` /
  `'google-drive'` — cũng sai, cũng không khớp catalog thật.

---

## Fix 1 — Web: sửa `requires` id cho khớp catalog thật

`apps/web/lib/skills.ts`:

```ts
// Tìm:
{ id: 'scheduler', icon: '🗓️', requires: ['gcal', 'gmail'] },
{ id: 'researcher', icon: '📚', requires: ['gdrive'] },

// Thay thành (khớp connector-service CATALOG ids thật: notion/gmail/calendar/drive):
{ id: 'scheduler', icon: '🗓️', requires: ['calendar', 'gmail'] },
{ id: 'researcher', icon: '📚', requires: ['drive'] },
```

Các skill khác (`mailWriter: ['gmail']`, `projectKeeper: ['notion']`) đã đúng, giữ nguyên.

## Fix 2 — Flutter: sửa `requires` id cho khớp catalog thật

`apps/client/lib/features/skills/data/skill_defs.dart`:

```dart
// Tìm:
SkillDef(id: 'scheduler', icon: '🗓️', requires: ['google-calendar', 'gmail']),
SkillDef(id: 'researcher', icon: '📚', requires: ['google-drive'], extras: ['web']),

// Thay thành:
SkillDef(id: 'scheduler', icon: '🗓️', requires: ['calendar', 'gmail']),
SkillDef(id: 'researcher', icon: '📚', requires: ['drive'], extras: ['web']),
```

**Lưu ý:** kiểm tra widget hiển thị "Needs: X" ở Flutter (`skills_screen.dart` hoặc tương đương) có
resolve tên connector qua đúng field `id`/`name` từ `CatalogEntry` hay không — mirror đúng logic web
(`catalogById.get(id)` → filter undefined).

## Fix 3 — Copy trung thực hơn (web `messages/*.json`, 7 locale)

Nguyên tắc: mô tả PHẢI phản ánh đúng "đây là cách AI trả lời/tư duy", không phải "AI sẽ tự làm việc
này". Sửa 3 skill copy sai nhiều nhất; các skill còn lại giữ nguyên (đã đủ trung thực — "Summarize",
"Prioritize... and suggest", "Analyze", "Draft", "Translate", "Finds... and cites", "Looks up..." đều
là verb mô tả ĐÚNG cái AI thực sự làm: xử lý text, không hành động ngoài conversation).

```json
// messages/en.json — trong namespace "skills", sửa:
"schedulerDesc": "Suggests meeting times and drafts invites — you still send them via your calendar/mail app (or connect Google Calendar/Gmail so it can act directly).",
"researcherDesc": "Answers from what's in this conversation and your training knowledge, with sources cited when possible — not a live web search.",
"projectKeeperDesc": "Tracks tasks, owners and decisions in the conversation and summarizes them — connect Notion so it can actually write them there.",

// messages/vi.json:
"schedulerDesc": "Đề xuất giờ họp và soạn sẵn lời mời — bạn vẫn cần tự gửi qua lịch/mail (hoặc kết nối Google Calendar/Gmail để AI tự thao tác được).",
"researcherDesc": "Trả lời dựa trên nội dung cuộc trò chuyện và kiến thức có sẵn, có trích nguồn khi có thể — không phải tìm kiếm web trực tiếp.",
"projectKeeperDesc": "Theo dõi công việc, người phụ trách và quyết định trong cuộc trò chuyện rồi tóm tắt lại — kết nối Notion để AI thực sự ghi vào đó.",
```

Áp dụng cùng tinh thần dịch cho `zh.json`, `ja.json`, `ko.json`, `fr.json`, `es.json` (giữ đúng
nghĩa: đề xuất/tóm tắt bằng lời, không phải hành động thật, có gợi ý connect connector).

Thêm 1 dòng disclaimer chung ở đầu trang, namespace `skills`:

```json
// en.json:
"realActionNote": "Skills change how your assistant thinks and talks. To let it actually act (send email, create events, write to Notion...), connect the matching app below.",
// vi.json:
"realActionNote": "Skill thay đổi CÁCH assistant suy nghĩ và trả lời. Để AI thực sự hành động (gửi mail, tạo lịch, ghi vào Notion...), kết nối app tương ứng bên dưới.",
```

`apps/web/app/(main)/skills/page.tsx` — thêm dòng này ngay dưới `{t('description')}`:

```tsx
// Tìm:
<p className="text-sm text-muted-foreground mt-1">{t('description')}</p>

// Thêm ngay sau:
<p className="text-sm text-pon-peach/80 mt-1">{t('realActionNote')}</p>
```

## Fix 4 — Flutter ARB copy (7 file `app_*.arb`) + skills screen

Áp dụng đúng 3 key đổi + 1 key mới (`realActionNote`) tương ứng bên trên vào
`skillSchedulerDesc`/`skillResearcherDesc`/`skillProjectKeeperDesc` (hoặc đúng pattern key hiện dùng
— kiểm tra `skills_screen.dart` để lấy đúng tên key) trên cả 7 file `app_en.arb`, `app_vi.arb`,
`app_zh.arb`, `app_ja.arb`, `app_ko.arb`, `app_fr.arb`, `app_es.arb`. Thêm `skillsRealActionNote` và
hiển thị dưới subtitle của skills screen, style tương tự web (màu nhấn, không phải error).

Sau khi sửa ARB: `flutter gen-l10n`.

---

## Verification

1. `pnpm build` (web) — PASS.
2. `flutter analyze` + `flutter gen-l10n` — PASS, không còn key thiếu.
3. Mở `/skills` (web) và Skills screen (Flutter): card Scheduler/Researcher/Project Keeper hiện đúng
   hint "Needs: Google Calendar, Gmail" / "Needs: Google Drive" / "Needs: Notion" (không còn rớt
   mất connector nào), và mô tả không còn khẳng định hành động thật.
4. Dòng disclaimer chung hiện đúng vị trí, đủ 7 ngôn ngữ.

## Lưu ý cho Claude Code

- Đây là fix content-only, KHÔNG sửa `ai.service.ts`/`skill-catalog.ts` — hành vi AI giữ nguyên,
  chỉ sửa để UI không nói dối về khả năng thật.
- Việc thực sự wire skill vào tool thật nằm ở plan riêng
  `2026-07-10-skills-real-tool-wiring.md` — không tự ý mở rộng sang đó trong plan này.
