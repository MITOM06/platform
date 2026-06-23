## Web Implementation Report — TASK-12 (Workspace-level AI settings, admin console)

### What was built
A new **AI Assistant** admin panel in the web admin console, alongside the existing
Workspace / SSO panels. It reads/writes `aiSettings` as part of the **existing**
`GET/PATCH /admin/workspace` contract via the existing `adminService` + `useWorkspace()` /
`useUpdateWorkspace()` hooks — **no new endpoint, no new API client, no new hook**. Gated by
the existing `MANAGE_WORKSPACE` capability using the existing `RequireCap` pattern, with a nav
entry added to `ADMIN_SECTIONS`. Every field is nullable; `null`/empty = "inherit the
ai-service env default".

### 변경된 파일 (Files touched)
- `apps/web/lib/api/admin-types.ts` — **수정**. Added `AiTone` + `AI_TONES`, `AiModelTier` +
  `AI_MODEL_TIERS`, and `WorkspaceAiSettings` interface (all 7 fields nullable). Added
  `aiSettings?: WorkspaceAiSettings` to `Workspace` and `aiSettings?: Partial<WorkspaceAiSettings>`
  to `UpdateWorkspaceInput` (partial = deep-merged server-side per the contract). Strict TS, no `any`.
- `apps/web/components/admin/WorkspaceAiSettings.tsx` — **신규** (~270 lines, <400). The panel,
  mirroring `WorkspaceSettings.tsx`/`SsoPanel.tsx` patterns (`useWorkspace` + `useUpdateWorkspace`,
  reseed-on-load, native `<select>` like SsoPanel, `Switch`/`Checkbox`/`Input` shadcn controls).
- `apps/web/app/(main)/admin/ai/page.tsx` — **신규**. `<RequireCap cap="MANAGE_WORKSPACE">` wrapping
  the panel (mirror of `admin/sso/page.tsx`).
- `apps/web/components/admin/AdminShell.tsx` — **수정**. Added
  `{ href:'/admin/ai', cap:'MANAGE_WORKSPACE', labelKey:'navAi', icon: Sparkles }` to `ADMIN_SECTIONS`
  (placed right after SSO) + imported the `Sparkles` icon.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — **수정**. +31 keys each under the `admin` namespace.
- `apps/web/lib/hooks/use-admin.ts` — **변경 없음** (reused `useUpdateWorkspace`, already invalidates
  `admin-workspace` + `me-capabilities`).
- `apps/web/lib/api/admin.ts` — **변경 없음** (existing `updateWorkspace` PATCHes `/admin/workspace`).

### Fields / controls rendered
| Field (contract) | Control | null / "inherit" representation |
|------------------|---------|----------------------------------|
| `personaName` | text `<Input>` | empty string ⇒ `null` |
| `defaultTone` | `<select>` (friendly/professional/concise/creative) | "Default (inherit)" option ⇒ `null` |
| `modelTier` | `<select>` (auto/simple/mid/complex) | "Default (inherit)" option ⇒ `null` |
| `webSearchEnabled` | tri-state `<select>` (Default/Enabled/Disabled) | "Default" ⇒ `null`, else `true`/`false` |
| `thinkingEnabled` | tri-state `<select>` (Default/Enabled/Disabled) | "Default" ⇒ `null`, else `true`/`false` |
| `monthlyTokenLimit` | number `<Input min=0>` | empty ⇒ `null`; explicit `0` preserved (= block all) |
| `allowedConnectors` | "Restrict" `<Switch>` + `<Checkbox>` grid | Switch OFF ⇒ `null` (inherit); ON ⇒ explicit list (may be `[]`) |

The connector checkboxes are **constrained to `connectorAllowList ∩ catalog`** (from `useCatalog()`),
honoring the "AI list can only narrow the workspace allow-list" rule, and on save the list is
re-filtered to that subset. The UI distinguishes "inherit" (Switch off ⇒ `null`) from "allow none"
(Switch on, nothing checked ⇒ `[]`) exactly as the edge-case in the plan requires. Save sends
`save.mutate({ aiSettings: { ...all 7 fields } })`.

### TypeScript 타입 체크 결과
- `npx tsc --noEmit`: **errors: 0**
- `pnpm --filter @platform/web build`: **PASS** — "✓ Compiled successfully", `/admin/ai` route emitted
  (ƒ dynamic). Only pre-existing unrelated warnings (pnpm field / node engine) — no errors, no new warnings.

### i18n 추가 키 (31 keys × 7 locales, under `admin`)
- `navAi`: "AI Assistant"
- `aiPersonaTitle`: "Assistant persona" · `aiInheritHint`: "Leave a field on \"Default\" / empty to inherit the server default."
- `aiPersonaName`: "Assistant name" · `aiPersonaNamePlaceholder`: "PON AI"
- `aiTone`: "Default tone" · `aiTone_friendly/professional/concise/creative`: "Friendly/Professional/Concise/Creative"
- `aiDefaultOption`: "Default (inherit)"
- `aiModelTitle`: "Model & capabilities" · `aiModelTier`: "Default model tier" · `aiModelTierHint`: "Forcing a tier overrides automatic model routing."
- `aiTier_auto/simple/mid/complex`: "Auto (router decides)/Simple/Mid/Complex"
- `aiWebSearch`: "Web search" · `aiThinking`: "Extended thinking" · `aiThinkingHint`: "Lets the assistant reason step by step before answering."
- `aiEnabled`: "Enabled" · `aiDisabled`: "Disabled"
- `aiTokenLimit`: "Monthly token limit" · `aiTokenLimitPlaceholder`: "No limit" · `aiTokenLimitHint`: "Leave empty to inherit the default. 0 blocks all usage."
- `aiConnectorsTitle`: "AI connector allow-list" · `aiConnectorsHint`: "Restrict which connectors the assistant may use. Can only narrow the workspace allow-list."
- `aiRestrictConnectors`: "Restrict assistant connectors" · `aiRestrictConnectorsHint`: "Off = inherit the workspace allow-list. On = only the selected connectors (none if empty)." · `aiNoConnectors`: "No connectors in the workspace allow-list."

All 31 keys added to **all 7 locales** (en, vi, zh, ja, ko, es, fr) with native translations — no
English fallthrough. JSON validated for all locales; en.json diff is +32/-1 lines (no spurious reformat).

### Backend contract conformance
- Rides on existing `GET/PATCH /admin/workspace` — no new endpoint/client. ✓
- Field names + types match the plan contract EXACTLY: `personaName: string|null`,
  `defaultTone: 'friendly'|'professional'|'concise'|'creative'|null`,
  `modelTier: 'auto'|'simple'|'mid'|'complex'|null`, `webSearchEnabled/thinkingEnabled: boolean|null`,
  `monthlyTokenLimit: number|null`, `allowedConnectors: string[]|null`. ✓
- PATCH sends only `aiSettings` (partial) → relies on the backend deep-merge; `null` semantics and
  `allowedConnectors` null-vs-`[]` distinction preserved. ✓
- Gated by existing `MANAGE_WORKSPACE` (RequireCap + nav `cap`). ✓

### Flutter 미러 파일 동기화 확인 (sync.md)
- `WorkspaceAiSettings.tsx` ↔ `workspace_ai_settings_panel.dart` (mobile-dev, parallel): **same field set,
  same `aiSettings` shape, same `MANAGE_WORKSPACE` gating, same `/admin/workspace` PATCH** per 01_plan.md.
  At report time the Flutter panel file is not yet present on disk (mobile-dev runs in parallel); the web
  panel implements the identical fixed contract, so parity holds once the mobile panel lands. The QA agent
  should confirm both panels expose the identical 7 fields (a field on one client only is a P1 per sync.md).

### 주의사항 (Notes)
- Followed the established admin convention of native `<select>` (as `SsoPanel.tsx` does) rather than the
  shadcn `Select` Radix component, for visual + behavioral consistency with the existing admin panels.
- `monthlyTokenLimit` parsing floors to a non-negative integer; empty ⇒ `null`, `0` is preserved and sent
  (explicit "block all"), per the edge case.
- The connector checkboxes intersect catalog with `connectorAllowList`; if the workspace allow-list is
  empty, the restrict grid shows `aiNoConnectors`. Save still re-filters to the subset defensively.
