## Mobile Implementation Report — TASK-12 (Workspace-level AI settings)

### What I built
A new **AI assistant** tab in the Flutter admin console (`apps/client/lib/features/admin/`),
mirroring the existing Workspace/SSO panels. It is gated by the **existing** `MANAGE_WORKSPACE`
capability (`Cap.manageWorkspace`) via the established `_Section(cap, …)` + `caps.has(s.cap)` /
`canAccessAdmin` gating in `admin_screen.dart` — **no new capability** and **no new endpoint**.

AI settings ride on the **existing** `GET/PATCH /admin/workspace` contract through the existing
`AdminRepository.getWorkspace()`/`updateWorkspace(patch)` (authDio :3001) and the existing
`WorkspaceNotifier.save()` AsyncNotifier (which already invalidates `capabilitiesProvider`).
Save sends `{ "aiSettings": { …only the AI fields… } }` — a partial PATCH the backend deep-merges.

All seven `aiSettings` fields are parsed/serialized exactly per the FIXED plan contract, with
`null` = "inherit env/default" semantics preserved end-to-end (empty field ⇒ `null` ⇒ never
overrides the ai-service env fallback). `allowedConnectors` distinguishes `null` (inherit
`connectorAllowList`) from `[]` (explicit "allow none") via a "Restrict connectors for AI" switch.

### Files touched
- `apps/client/lib/features/admin/data/models/admin_models.dart` — **modified**. Added immutable
  `WorkspaceAiSettings` model (all 7 fields nullable; `tones`/`modelTiers` const lists) with
  `fromJson` that parses `null`-as-inherit and treats absent `allowedConnectors` as `null` vs
  explicit `[]`. Added `aiSettings` field to `Workspace` (defaults to `const WorkspaceAiSettings()`,
  backward compatible) + parsed it in `Workspace.fromJson`.
- `apps/client/lib/features/admin/ui/widgets/workspace_ai_settings_panel.dart` — **new** (219 lines).
  `WorkspaceAiSettingsPanel` ConsumerStatefulWidget. Reads `workspaceProvider` + `adminCatalogProvider`
  (reused from `workspace_panel.dart`), `AsyncValue.when(loading/error/data)`, seeds controllers once,
  builds the partial `aiSettings` patch and saves via `workspaceProvider.notifier.save(...)`.
- `apps/client/lib/features/admin/ui/widgets/ai_settings_controls.dart` — **new** (211 lines).
  Extracted reusable presentation widgets to keep the panel < 400 lines (clean-code rule):
  `AiConnectorChecklist`, `AiTriStateTile`, `AiLabeledDropdown` (+`AiDropItem`), `AiSectionTitle`,
  `AiMutedText`, `AiErrorView`.
- `apps/client/lib/features/admin/ui/admin_screen.dart` — **modified**. Added
  `_Section(Cap.manageWorkspace, Icons.auto_awesome, (c)=>c.l10n.adminNavAi, const WorkspaceAiSettingsPanel())`
  to `_sections()` (placed right after Workspace, before SSO) + import.
- `apps/client/lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` — **modified**. +30 keys each (all 7 locales).
- `apps/client/lib/l10n/app_localizations*.dart` — regenerated via `flutter gen-l10n` (not hand-edited).

`apps/client/lib/features/admin/data/admin_repository.dart` — **unchanged** (reused
`updateWorkspace(Map patch)` / `getWorkspace()`). `admin_providers.dart` — **unchanged** (reused
`workspaceProvider` / `WorkspaceNotifier.save`).

### Fields / controls (per plan contract; PATCH key → control)
- `personaName: string|null` — text field (empty ⇒ null).
- `defaultTone: 'friendly'|'professional'|'concise'|'creative'|null` — dropdown with "Inherit" sentinel ⇒ null.
- `modelTier: 'auto'|'simple'|'mid'|'complex'|null` — dropdown; `'auto'` ⇒ null (env router).
- `webSearchEnabled: boolean|null` — tri-state segmented control (Inherit / On / Off).
- `thinkingEnabled: boolean|null` — tri-state segmented control (Inherit / On / Off).
- `monthlyTokenLimit: number|null` — digits-only number field; empty ⇒ null; `0` is a valid explicit value.
- `allowedConnectors: string[]|null` — "Restrict connectors for AI" switch (off ⇒ null = inherit;
  on ⇒ explicit list, possibly `[]`). The checklist is constrained to `workspace.connectorAllowList`
  (the AI list can only narrow the outer boundary), built from the connector catalog.

### i18n added keys (30 keys × 7 locales = 210 entries; English template values)
- `adminNavAi`: "AI assistant"
- `adminAiInheritHint`: "Leave a field empty or set \"Inherit\" to use the server default."
- `adminAiInheritOption`: "Inherit (default)"
- `adminAiOn`: "On" / `adminAiOff`: "Off"
- `adminAiPersonaSection`: "Persona" / `adminAiPersonaName`: "Default assistant name"
- `adminAiTone`: "Default tone" + `adminAiToneFriendly/Professional/Concise/Creative`
- `adminAiModelSection`: "Model" / `adminAiModelTier`: "Default model tier"
- `adminAiTierAuto`: "Auto (router)" / `adminAiTierSimple`: "Simple" / `adminAiTierMid`: "Balanced" / `adminAiTierComplex`: "Advanced"
- `adminAiCapabilitiesSection`: "Capabilities"
- `adminAiWebSearch`: "Web search" / `adminAiWebSearchDesc`: "Allow the assistant to search the web."
- `adminAiThinking`: "Extended thinking" / `adminAiThinkingDesc`: "Allow the assistant to reason step by step."
- `adminAiQuotaSection`: "Usage limit" / `adminAiTokenLimit`: "Monthly token limit" / `adminAiTokenLimitDesc`: "Leave empty to inherit; 0 blocks all usage."
- `adminAiConnectorsSection`: "Allowed connectors" / `adminAiRestrictConnectors`: "Restrict connectors for AI"
- `adminAiConnectorsInherit`: "Inheriting the workspace allow-list." / `adminAiConnectorsExplicit`: "AI may only use the connectors selected below."

All 7 ARB files validated as JSON; `flutter gen-l10n` regenerated localizations (no manual edits).

### flutter analyze result
`cd apps/client && flutter analyze` → **No issues found!** (issues: **0**). Scoped run on
`lib/features/admin lib/l10n` also clean. (Only the unrelated standing iOS "Swift Package Manager"
plugin notice prints — not from this change.)

### Web ↔ Mobile parity (sync.md)
- **Field set parity:** Flutter writes the identical `aiSettings` shape the plan fixes for both
  clients: `personaName, defaultTone, modelTier, webSearchEnabled, thinkingEnabled, monthlyTokenLimit,
  allowedConnectors` — same names, same types, same nullable/inherit semantics, same enum value sets
  (`friendly|professional|concise|creative`, `auto|simple|mid|complex`).
- **Gating parity:** both panels are gated by `MANAGE_WORKSPACE` (web `<RequireCap cap="MANAGE_WORKSPACE">`
  per plan; Flutter `Cap.manageWorkspace`).
- **Mutation parity:** both PATCH the same `/admin/workspace` with a partial `{ aiSettings: {...} }`
  via the shared admin service/repository (no new endpoint).
- **Caveat (parity to confirm at QA):** the web AI panel files
  (`apps/web/components/admin/WorkspaceAiSettings.tsx`, `apps/web/lib/api/admin-types.ts` `aiSettings`)
  were **not present** when I implemented (web-dev runs in parallel per the plan's step 4). Flutter is
  built strictly to the FIXED plan contract, so it will match once web lands. The existing
  `02_web_report.md` in `_workspace/` is the TASK-09 report, not TASK-12 — so no web TASK-12 field list
  existed to diff against; verify web↔mobile field parity in QA.

### Notes / decisions
- Reused `adminCatalogProvider` (already defined in `workspace_panel.dart`) rather than redefining it,
  keeping a single source for the catalog fetch.
- Tri-state booleans use a 3-segment `SegmentedButton` (Inherit / On / Off) so the UI can express
  `null` (inherit) distinctly from explicit `false` — a plain `Switch` cannot represent "inherit".
- `monthlyTokenLimit` field is digits-only (`FilteringTextInputFormatter.digitsOnly`); empty ⇒ `null`
  (inherit), explicit `0` ⇒ block-all (sent as `0`, per the plan's edge case).
- Client does **not** re-validate `allowedConnectors ⊆ connectorAllowList` beyond constraining the
  checklist to the allow-list; the backend is the authority and rejects violations with 400 (surfaced
  via the existing error snackbar path).
