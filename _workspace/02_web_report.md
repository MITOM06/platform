## Web Implementation Report — TASK-11 (daily digest opt-in toggle)

### Summary
Small extension to the EXISTING TASK-12 AI settings admin panel. Added the workspace-level daily-digest opt-in (tri-state toggle + delivery-hour selector) to `WorkspaceAiSettings.tsx`, extended the `WorkspaceAiSettings` TS type with 2 nullable fields, and added 4 i18n keys to all 7 locales. No new page, no new endpoint, no new hook, no message-type code — fired reminders/digests arrive as normal `type:"ai"` messages the chat already renders. Rides the existing `GET/PATCH /admin/workspace` mutation.

### 변경된 파일 (changed files)
- `apps/web/lib/api/admin-types.ts` — extended `WorkspaceAiSettings` interface with `dailyDigestEnabled: boolean | null` and `dailyDigestHour: number | null` (null = inherit ai-service env default). The `UpdateWorkspaceInput.aiSettings` is `Partial<WorkspaceAiSettings>`, so the PATCH body automatically accepts the new fields.
- `apps/web/components/admin/WorkspaceAiSettings.tsx` — added state (`dailyDigest: TriState`, `digestHour: string`), reseed-from-server logic, `parseDigestHour()` (clamps 0–23, '' → null), save-payload entries, and two controls in the "Model & capabilities" section.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — added 4 i18n keys under the `admin` namespace (all 7 locales).

### Controls added
- **`aiDailyDigest`** — tri-state `<select>` (Default / Enabled / Disabled) reusing the exact same `TriState` ↔ `boolean | null` pattern as the existing web-search & thinking toggles (`boolToTri` / `triToBool`). null = inherit default.
- **`aiDailyDigestHour`** — `<select>` of `00:00`–`23:00` (values `'0'`..`'23'`, plus a Default/inherit option). **Disabled when the digest toggle is explicitly `off`** (`disabled={dailyDigest === 'off'}`). On save, '' → `null`; otherwise the clamped integer hour.
- Gating: the whole panel is already mounted behind `MANAGE_WORKSPACE` (admin route) — no extra gating needed; it rides the existing `useUpdateWorkspace()` → `PATCH /admin/workspace` mutation.

### i18n 추가 키 (added, EN text)
- `aiDailyDigest`: "Daily digest"
- `aiDailyDigestHint`: "Posts an AI-written summary of the previous day into each active assistant conversation."
- `aiDailyDigestHour`: "Digest delivery hour"
- `aiDailyDigestHourHint`: "Local hour (0–23) the digest is sent. Leave on Default to inherit."
- Translated for all of: en, vi, zh, ja, ko, es, fr (7/7).

### TypeScript / 빌드 결과
- `pnpm --filter @platform/web build` → **PASS** — `✓ Compiled successfully in 2.4s`. No TypeScript or ESLint errors. (Only unrelated pre-existing warnings: pnpm `onlyBuiltDependencies` config notice + a Node engine notice from an unrelated workspace package.)
- errors: 0
- No `any` used; both new fields strictly typed `boolean | null` / `number | null`.

### Backend contract 일치 확인 (per 01_plan.md §API Contract item 3)
- Plan contract: `PATCH /api/admin/workspace` body `{ aiSettings: { dailyDigestEnabled?: boolean|null, dailyDigestHour?: number|null /* 0..23 */ } }`.
- Web sends exactly these field names with these types via the existing mutation. ✓ Field names, nullability, and 0–23 range all match. (No standalone TASK-11 backend report was present — the `02_backend_report.md` on disk is the TASK-13 dashboard report — so the contract was taken from `01_plan.md`.)

### Flutter 미러 파일 동기화 확인 (per sync.md)
- `WorkspaceAiSettings.tsx` ↔ `workspace_ai_settings_panel.dart`: ✓ — both render the digest toggle + hour selector, gated by `MANAGE_WORKSPACE`, on the same `PATCH /admin/workspace`.
- Field names/types ↔ `admin_models.dart`: ✓ — Flutter model already has `dailyDigestEnabled` (bool?) + `dailyDigestHour` (int?) with identical `null = inherit` semantics and same JSON keys (`dailyDigestEnabled`, `dailyDigestHour`).
- Hour disabled when digest off: ✓ on both — Flutter disables the picker and sends `dailyDigestHour: enabled==true ? hour : null`; web disables the selector when `'off'`.
- Message delivery (`MessageBubble.tsx` `case 'ai'` ↔ `message_bubble.dart`): ✓ verification-only — reminders/digests arrive as `type:"ai"`, already rendered on both. No message-type code added.

### 주의사항 (notes)
- Behavioral divergence (cosmetic only): web keeps any previously-set `dailyDigestHour` value when the toggle is set to `off` (selector just disabled, not cleared), whereas Flutter nulls the hour in its payload when not enabled. Both are backend-valid (hour is ignored by the cron when digest is disabled), so this is not a contract break. Left as-is to preserve the admin's chosen hour across toggling; if exact payload parity is wanted, force `dailyDigestHour: null` when `dailyDigest !== 'on'`.
- This file previously contained the TASK-13 web report; overwritten per task instruction.
