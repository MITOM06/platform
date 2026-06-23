## Mobile Implementation Report — TASK-11 Daily Digest Opt-in Toggle

### What was added
Extended the EXISTING TASK-12 admin AI settings panel with the daily-digest opt-in.
No new screen, no new endpoint, no message-type code. Delivery (reminders/digests)
arrives as normal `type:"ai"` messages already rendered by `message_bubble.dart`.

Two new controls in the workspace AI settings panel:
1. **Daily digest** — tri-state toggle (`inherit / On / Off`) reusing the existing
   `AiTriStateTile` pattern (same as web-search & extended-thinking). `null` = inherit env.
2. **Delivery time** — hour picker (0–23, rendered `HH:00`) via a new `AiHourPicker`
   widget. Disabled/greyed out when the digest is not On. Shows the env default hour
   (08:00) until an explicit hour is chosen.

Mutation rides the existing `PATCH /admin/workspace` via
`workspaceProvider.notifier.save({'aiSettings': …})` — no new endpoint.
`dailyDigestHour` is only sent when the digest is On; otherwise `null` (inherit).

### 변경된 파일 (files touched)
- `apps/client/lib/features/admin/data/models/admin_models.dart` — added `dailyDigestEnabled` (bool?) + `dailyDigestHour` (int?) to `WorkspaceAiSettings` model + constructor + `fromJson` (null-as-inherit, backward compatible; absent/null → null).
- `apps/client/lib/features/admin/ui/widgets/ai_settings_controls.dart` — new `AiHourPicker` widget (0–23, disabled when digest off).
- `apps/client/lib/features/admin/ui/widgets/workspace_ai_settings_panel.dart` — state fields `_dailyDigestEnabled`/`_dailyDigestHour`, seeding, `_buildAiSettings()` payload, new "Daily digest" section (tri-state tile + hour picker) inserted before the Quota section.
- `apps/client/lib/l10n/app_en.arb` + 6 others (`vi, zh, ja, ko, es, fr`) — 5 new keys each.
- `apps/client/lib/l10n/app_localizations*.dart` — regenerated via `flutter gen-l10n` (generated; not hand-edited).

### Controls
| Control | Field | Behavior |
|---------|-------|----------|
| Tri-state SegmentedButton | `dailyDigestEnabled` | inherit (null) / On (true) / Off (false) — matches existing pattern |
| Hour dropdown (HH:00, 0–23) | `dailyDigestHour` | enabled only when digest On; null = inherit env hour |

### i18n 추가 키 (×7 locales)
- `adminAiDigestSection`: "Daily digest" (section title)
- `adminAiDailyDigest`: "Daily digest"
- `adminAiDailyDigestDesc`: "Post a once-a-day summary of each AI conversation's activity."
- `adminAiDailyDigestHour`: "Delivery time"
- `adminAiDailyDigestHourDesc`: "Local hour the digest is delivered. Available when the digest is on."

All 5 keys added to en, vi, zh, ja, ko, es, fr (no English fallbacks).

### flutter analyze 결과
- `cd apps/client && flutter analyze` → **No issues found!** (0 issues, ran in 12.1s)

### flutter test 결과
- `cd apps/client && flutter test` → **All tests passed!** (47 passed, 0 failed)
- Both commands were run (not just analyze) per the instruction.

### File line limits (.claude/rules/clean-code.md)
- workspace_ai_settings_panel.dart: 245 / 400
- ai_settings_controls.dart: 274 / 400
- admin_models.dart: 379 (model file; UI limit applies to widgets/screens — kept lean)

### Parity with web panel (.claude/rules/sync.md)
Mobile now exposes the SAME two fields the web `WorkspaceAiSettings.tsx` panel is slated
to add: `dailyDigestEnabled` (boolean|null) + `dailyDigestHour` (number 0–23|null), both
gated behind the admin AI settings surface (`MANAGE_WORKSPACE`), both riding the same
`PATCH /admin/workspace` mutation. Matches `01_plan.md` §API Contract item 3. At report
time `grep dailyDigest apps/web/` returned no matches → web has not yet landed; the field
names/types here are the canonical contract for web to mirror.

### Notes
- Reminder/digest DELIVERY needed zero client message-type work — they arrive as
  `type:"ai"` messages already rendered by `message_bubble.dart` (verification-only).
- Backward compatible: existing workspace docs with no `dailyDigest*` parse as null
  (= inherit env); the panel shows the tri-state "inherit" segment and the env default
  hour (08:00) placeholder.
