## QA Report — TASK-12 (Workspace-level AI Settings) — 2026-06-23

### Verdict: **PASS**

All three platforms build/test green. The highest-risk item — the `aiSettings` contract
built in parallel by web-dev and mobile-dev against the plan BEFORE the backend report existed —
matches **exactly** across backend schema/DTO, web TypeScript, and Flutter Dart: same 7 field
names, same types, same enum value sets, same `null`-vs-`[]` semantics. ai-service is fully
backward compatible (env fallback on null/absent) and the Redis invalidation channel name is
identical on publisher and subscriber. No P1 found.

---

### Build / Test status (exact captured output, run by QA — not trusted from reports)

| Service | Command | Result |
|--------|---------|--------|
| @platform/database | `pnpm --filter @platform/database test` | ✓ PASS — Test Suites: 4 passed, 4 total; Tests: 16 passed, 16 total |
| auth-service | `pnpm --filter @platform/auth-service build` | ✓ PASS — webpack 5.104.1 compiled successfully in 2124 ms |
| auth-service | `pnpm --filter @platform/auth-service test` | ✓ PASS — Test Suites: 12 passed, 12 total; Tests: 52 passed, 52 total |
| ai-service | `pnpm --filter ai-service build` | ✓ PASS — nest build, exit 0 |
| ai-service | `pnpm --filter ai-service test` | ✓ PASS — Test Suites: 28 passed, 28 total; Tests: 243 passed, 243 total |
| web | `pnpm --filter @platform/web build` | ✓ PASS — "✓ Compiled successfully in 2.9s"; route `├ ƒ /admin/ai` emitted (dynamic) |
| client (Flutter) | `cd apps/client && flutter analyze` | ✓ PASS — "No issues found! (ran in 6.4s)" (only unrelated emoji_picker_flutter SPM notice) |

All seven commands exit 0. Reports' claimed numbers reproduce exactly.

---

### CRITICAL CHECK — Contract parity (aiSettings) across all 3 platforms

Sources read and field-by-field compared (not existence-checked):
- Backend schema: `packages/database/src/mongo/workspace.schema.ts` (`WorkspaceAiSettings`)
- Backend DTO: `apps/server/auth-service/src/modules/admin/dto/workspace.dto.ts` (`WorkspaceAiSettingsDto`)
- Web: `apps/web/lib/api/admin-types.ts` (`WorkspaceAiSettings`)
- Flutter: `apps/client/lib/features/admin/data/models/admin_models.dart` (`WorkspaceAiSettings`)

| Field | Backend schema | Backend DTO validator | Web type | Flutter type | Match |
|-------|----------------|----------------------|----------|--------------|-------|
| `personaName` | `String, default null` | `@IsString` opt+nullable | `string \| null` | `String?` | ✓ |
| `defaultTone` | `String, default null` | `@IsIn(friendly,professional,concise,creative)` | `AiTone \| null` (same 4) | `String?` (tones list: same 4) | ✓ |
| `modelTier` | `String, default null` | `@IsIn(auto,simple,mid,complex)` | `AiModelTier \| null` (same 4) | `String?` (modelTiers: same 4) | ✓ |
| `webSearchEnabled` | `Boolean, default null` | `@IsBoolean` opt+nullable | `boolean \| null` | `bool?` | ✓ |
| `thinkingEnabled` | `Boolean, default null` | `@IsBoolean` opt+nullable | `boolean \| null` | `bool?` | ✓ |
| `monthlyTokenLimit` | `Number, default null` | `@IsInt @Min(0)` opt+nullable | `number \| null` | `int?` | ✓ |
| `allowedConnectors` | `[String], default () => null` | `@IsArray @IsString({each})` opt+nullable | `string[] \| null` | `List<String>?` | ✓ |

**Exactly 7 fields on every platform — no extra, none missing. Names, types, and enum value sets all match.**

**`null`-vs-`[]` semantics for `allowedConnectors` (the most fragile point) — verified on all layers:**
- Backend schema uses `default: () => null` (function default) specifically because a bare
  `default: null` on a Mongoose array prop is coerced to `[]` — this preserves the null (inherit)
  vs [] (allow none) distinction. ✓
- Backend resolve (`ai-service settings.service.ts:99`): `allowedConnectors: s.allowedConnectors ?? null`
  — null/absent ⇒ null (inherit); [] preserved. ✓
- Backend filter (`tool-registry.service.ts:37`): `if (allowedConnectors == null) return tools` (inherit, no filter); a `[]` produces an empty allow-set ⇒ all MCP tools dropped. ✓
- Web parse/save (`WorkspaceAiSettings.tsx`): "Restrict" Switch OFF ⇒ `null`; ON ⇒ explicit list (may be `[]`). ✓
- Flutter parse (`admin_models.dart:177`): `j.containsKey('allowedConnectors') && j[...] != null ? list : null`
  — distinguishes absent (null=inherit) from explicit []. Save (`_buildAiSettings`): `_restrictConnectors ? _allowed : null`. ✓

No drift. **Contract parity: PASS (no P1).**

---

### Cross-platform sync (.claude/rules/sync.md)

- [x] **Both clients gate by MANAGE_WORKSPACE.** Web: `<RequireCap cap="MANAGE_WORKSPACE">` in `admin/ai/page.tsx` + nav entry `{ href:'/admin/ai', cap:'MANAGE_WORKSPACE' }` in `AdminShell.tsx`. Flutter: `_Section(Cap.manageWorkspace, Icons.auto_awesome, …)` in `admin_screen.dart`. Same capability, no new capability.
- [x] **Both mutate via the existing GET/PATCH /admin/workspace** — no new endpoint/client/hook. Web: `useWorkspace()` + `useUpdateWorkspace()` → `save.mutate({ aiSettings })`. Flutter: `workspaceProvider.notifier.save({'aiSettings': …})` (reused `AdminRepository.updateWorkspace` on authDio :3001).
- [x] **Same field set + matching controls.** Both emit the identical 7-field partial `{ aiSettings: {...} }`:
  persona text, tone dropdown, model-tier dropdown, **tri-state** web-search & thinking (Default/Inherit · On · Off — neither uses a plain Switch, both can express `null`), token-limit number (empty⇒null, 0 preserved), and a **connector allow-list restrict switch** (off⇒null inherit, on⇒explicit list possibly []) constrained to `connectorAllowList ∩ catalog`.
- [x] **i18n keys present in all 7 locales on BOTH platforms.** Web `messages/{en,vi,zh,ja,ko,es,fr}.json`: AI key count uniform across all 7 (identical per locale). Flutter `app_*.arb`: exactly **30** `adminNavAi`/`adminAi*` keys in each of the 7 locales (uniform). No locale missing keys; `flutter gen-l10n` regenerated (analyze clean).

---

### Backend behavior confirmations

- [x] **ai-service env fallback when aiSettings null/absent (backward compatible).** `settings.service.ts resolve()` maps each null field to its env/config value: `webSearchEnabled ?? config.webSearch.enabled (true)`, `thinkingEnabled ?? config.ai.enableThinking (false)`, `monthlyTokenLimit ?? config.quota.monthlyTokenLimit ?? 500000`, `modelTier 'auto' ⇒ env router`, persona null ⇒ persona-layer default. Fresh deploy (`findOne` ⇒ null) ⇒ pure env defaults. `0`/`false` correctly preserved as real overrides (uses `??`, not `||`). Load failures fall back to env-only and are NOT cached. Threaded into all 5 read paths in `ai.service.ts` (quota :152, persona :220-221, forcedTier :256, thinking :398, web-search/connectors :418-419).
- [x] **Redis `ai:settings:invalidate` channel name matches publisher ↔ subscriber.** Publisher: auth-service `admin.service.ts:39` `AI_SETTINGS_INVALIDATE_CHANNEL = 'ai:settings:invalidate'`, published only when `dto.aiSettings !== undefined` (failure non-fatal, logged). Subscriber: ai-service `settings-invalidator.service.ts:7` same literal, channel-filtered so it coexists with the kb:* subscriber → `settingsService.invalidate()`. 60s TTL is the safety net.
- [x] **Deep-merge, not replace.** `updateWorkspace()` builds per-key dot-path `$set` (`aiSettings.<key>`), skips `undefined`, preserves `null` as meaningful "inherit" — a partial PATCH never wipes sibling fields.
- [x] **Subset validation.** `validateAiSettings()` rejects (400 `AI_CONNECTORS_NOT_IN_ALLOW_LIST`) a non-empty `allowedConnectors` not ⊆ `connectorAllowList`; `null` and `[]` always pass.

---

### Findings

| Severity | File:line | Finding | Recommendation |
|----------|-----------|---------|----------------|
| Info (known limitation, NOT a blocker) | `ai-service/tools/tool-registry.service.ts:23` | Custom MCP servers are namespaced `mcp__custom:<id>__<tool>`; their provider segment `custom:<id>` is not a catalog id, so a custom MCP server can never appear in `allowedConnectors` and is **dropped whenever a non-null AI allow-list is set**. This is the conservative deny-by-default, documented in the plan and backend report. | Accept as documented deferral. Follow-up if needed: expose `custom:<id>` ids in the admin UI or have connector-service return a per-tool connector id. |
| Info (no functional impact) | web `WorkspaceAiSettings.tsx` vs Flutter `_buildAiSettings()` | `modelTier`: Flutter maps explicit `'auto'` ⇒ `null` before sending; web sends `'auto'` literally. Backend `normalizeModelTier('auto')`/`null` both resolve to the env router, so behavior is identical. Cosmetic only — not drift. | No action. |
| Info | `ai-service/src/ai/ai.service.ts` (604 lines) | Over the ai-service 300-line soft limit; pre-existing, TASK-12 added ~15 net lines. | Out of scope; leave as-is. |

No Blocker, P1, or P2 issues.

### Conclusion
**PASS** — Builds and tests green on all 3 platforms (DB 16, auth 52, ai 243 tests; web compiled; flutter analyze clean). The parallel-built `aiSettings` contract matches exactly across backend schema/DTO, web, and Flutter (7 fields, types, enums, and the null-vs-[] connector semantics). Both clients gate by MANAGE_WORKSPACE and ride the existing GET/PATCH /admin/workspace with matching controls and full 7-locale i18n. ai-service is backward compatible (env fallback) and the Redis invalidation channel matches end-to-end. The custom-MCP allow-list gap is an accepted documented limitation, not a blocker. No owner action required to ship.
