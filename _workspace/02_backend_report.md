# Backend Implementation Report — TASK-12 (Workspace-level AI Settings)

## What was built

Workspace-level AI settings now ride on the existing `Workspace` singleton document and the existing `/admin/workspace` admin API (gated by the existing `MANAGE_WORKSPACE` capability — no new capability). auth-service owns/writes them and publishes a Redis invalidation message on save; ai-service reads them (cached, with Redis pub/sub + 60s TTL invalidation) and threads the resolved values into five read paths. Every field is null-able and falls back to the existing env-var behavior, so the change is fully backward compatible.

### 1. packages/database (shared schema)
- Added `WorkspaceAiSettings` class + `WorkspaceAiSettingsSchema` (mirrors the `WorkspaceSso` pattern) and an `aiSettings` prop on `Workspace`, defaulting to `() => ({})` (all-null ⇒ pure env behavior, no migration needed).
- Auto-exported via the existing `export * from './mongo/workspace.schema'` barrel.
- Important fix: `allowedConnectors` uses `default: () => null` (function default) — a bare `default: null` on an array prop is coerced by Mongoose to `[]`, which would erase the critical **null (inherit) vs [] (allow none)** distinction.

### 2. auth-service (owner / writer)
- DTO: added `WorkspaceAiSettingsDto` (all fields `@IsOptional` + nullable; `@IsIn` for tone/tier, `@IsInt @Min(0)` for limit, `@IsArray @IsString({each:true})` for connectors) + `aiSettings?` (`@ValidateNested`) on `UpdateWorkspaceDto`.
- `AdminService.updateWorkspace()`:
  - **Deep-merge** `aiSettings` via dot-path `$set` (`aiSettings.<key>`) so a partial PATCH never wipes sibling fields (`undefined` keys skipped; `null` preserved as a meaningful "inherit").
  - **Validation**: rejects (400 `AI_CONNECTORS_NOT_IN_ALLOW_LIST`) when `allowedConnectors` is a non-empty array not a subset of `connectorAllowList`. `null` and `[]` always pass.
  - **Side effect**: on a successful save whose patch touched `aiSettings`, publishes `ai:settings:invalidate` `{"reason":"workspace.update"}` on the injected `REDIS_CLIENT` (failure logged, non-fatal — TTL safety net covers it).
  - Audit: unchanged `workspace.update` entry with `meta.changes` (now includes `aiSettings`).
- `REDIS_CLIENT` was already injectable (`DatabaseRedisModule` is `@Global` and already imported in `AdminModule`) — no module change needed.

### 3. ai-service (reader)
New read-only `SettingsModule`:
- `settings/workspace.schema.ts` — slim local read-only Mongoose model on collection `workspaces` (`strict:false`, only `aiSettings` projected). ai-service has no `@platform/database` dependency and defines local schemas by convention, so a local slim model avoids adding a cross-package dep. ai-service NEVER writes this collection.
- `settings/resolved-ai-settings.ts` — `ResolvedAiSettings` type + `normalizeModelTier()`.
- `settings/settings.service.ts` — `getSettings()` loads the singleton doc, `resolve()`s each field against env defaults, caches in-memory (singleton + 60s TTL, concurrent reloads collapsed, failures fall back to env-only and are NOT cached). `invalidate()` drops the cache.
- `settings/settings-invalidator.service.ts` — `OnApplicationBootstrap` subscribes to `ai:settings:invalidate` on the shared `REDIS_SUBSCRIBER`; on a message for that channel → `settingsService.invalidate()` (channel-filtered so it coexists with the kb:* subscriber).
- `app.module.ts` — registered `SettingsModule`.

Wired into the read paths (each null/absent ⇒ existing env behavior):
- `persona.service.ts buildSystemPrompt(persona, displayName, defaults?)` — workspace `personaName`/`defaultTone` fill missing fields; per-conversation persona stays highest precedence; hardcoded `PON AI`/`friendly` is the last fallback.
- `ai/model-router.ts selectModel` — new `forcedTier` on `RouteSignals`; `simple|mid|complex` overrides ALL heuristics (incl. the "KB ⇒ complex" rule); `auto`/undefined runs the env router.
- `ai/ai.service.ts` — loads settings once in `handleRequest` (cached); threads into persona build, quota check, `forcedTier`, `enableThinking` (now `ctx.settings.thinkingEnabled`, already resolved vs env), and `ToolContext`.
- `usage/usage.service.ts isQuotaExceeded(userId, limitOverride?)` — uses the resolved limit; `?? env`; `0` correctly preserved as "block all".
- `tools/tool-registry.service.ts getDefinitions(ctx)` — `web_search` gated on `ctx.webSearchEnabled !== false && webSearchService.isAvailable()` (composes with the TASK-09 provider gate); MCP tools filtered by `ctx.allowedConnectors` via the new exported pure `filterByAllowedConnectors()`.
- `tools/tool.interface.ts` — added `webSearchEnabled?` and `allowedConnectors?` to `ToolContext`.

## Files changed

### packages/database
- `src/mongo/workspace.schema.ts` — `WorkspaceAiSettings` + `aiSettings` prop (modified)
- `src/mongo/__tests__/workspace-ai-settings.spec.ts` — new tests

### auth-service
- `src/modules/admin/dto/workspace.dto.ts` — `WorkspaceAiSettingsDto` + `aiSettings?` (modified)
- `src/modules/admin/admin.service.ts` — deep-merge / validate / publish; `REDIS_CLIENT` injection; exported `AI_SETTINGS_INVALIDATE_CHANNEL` (modified)
- `src/modules/admin/admin.service.spec.ts` — Redis provider + 6 new updateWorkspace tests

### ai-service
- `src/settings/workspace.schema.ts` (new)
- `src/settings/resolved-ai-settings.ts` (new)
- `src/settings/settings.service.ts` (new)
- `src/settings/settings-invalidator.service.ts` (new)
- `src/settings/settings.module.ts` (new)
- `src/settings/settings.service.spec.ts` (new)
- `src/settings/settings-invalidator.service.spec.ts` (new)
- `src/app.module.ts` — register `SettingsModule` (modified)
- `src/ai/ai.service.ts` — thread settings into read path (modified)
- `src/ai/ai.service.spec.ts` — fake `SettingsService` dependency (modified)
- `src/ai/model-router.ts` — `forcedTier` (modified)
- `src/ai/model-router.spec.ts` — 5 new forcedTier tests
- `src/persona/persona.service.ts` — `PersonaDefaults` + `buildSystemPrompt` defaults arg (modified)
- `src/persona/persona.service.spec.ts` — 3 new workspace-default tests
- `src/usage/usage.service.ts` — `isQuotaExceeded(userId, limitOverride?)` (modified)
- `src/usage/usage.service.spec.ts` — 3 new override tests
- `src/tools/tool.interface.ts` — `ToolContext` fields (modified)
- `src/tools/tool-registry.service.ts` — web-search gate + `filterByAllowedConnectors` (modified)
- `src/tools/tool-registry.service.spec.ts` — 7 new toggle/filter tests

## aiSettings JSON contract (so clients match exactly)

```jsonc
"aiSettings": {
  "personaName":       "string | null",   // null => env AI_BOT_DISPLAY_NAME / "PON AI"
  "defaultTone":       "string | null",   // 'friendly'|'professional'|'concise'|'creative'; null => 'friendly'
  "modelTier":         "string | null",   // 'auto'|'simple'|'mid'|'complex'; null/'auto' => env router
  "webSearchEnabled":  "boolean | null",  // null => env WEB_SEARCH_ENABLED (default on)
  "thinkingEnabled":   "boolean | null",  // null => env AI_ENABLE_THINKING (default off)
  "monthlyTokenLimit": "number | null",   // >= 0; null => env AI_MONTHLY_TOKEN_LIMIT (default 500000); 0 = block all
  "allowedConnectors": "string[] | null"  // null = inherit connectorAllowList; [] = allow none; [...] = subset of connectorAllowList
}
```

- `GET /admin/workspace` returns the full `Workspace` shape with `aiSettings` (additive).
- `PATCH /admin/workspace` accepts `aiSettings?` (all fields optional + nullable); partial patches deep-merge.
- Both gated by `MANAGE_WORKSPACE` (the route already was — `admin.controller.ts:124`).

### API endpoints (verified)
- `GET /admin/workspace` — implemented (returns aiSettings additively via the Workspace doc)
- `PATCH /admin/workspace` — implemented (accepts aiSettings; deep-merge + validate + publish)

### Env-var fallback behavior (backward compatibility)
Every field is `null` by default. `null`/absent => the field never overrides the env var: `SettingsService.resolve()` maps `null` to the existing env/config value (`config.webSearch.enabled`, `config.ai.enableThinking`, `config.quota.monthlyTokenLimit`); `modelTier` 'auto' => the env model router; `personaName`/`defaultTone` null => persona-layer defaults; `allowedConnectors` null => no AI-specific connector filtering. A fresh deploy with no Workspace doc (`findOne` => null) resolves to pure env defaults. `0` and `false` are correctly preserved as real overrides (not coerced to fallback).

## Build / test results (exact)

| Command | Result |
|---------|--------|
| `pnpm --filter @platform/database test` | PASS — Test Suites: 4 passed, 4 total; Tests: 16 passed, 16 total |
| `pnpm --filter ai-service build` | PASS — `nest build`, exit 0 |
| `pnpm --filter ai-service test` | PASS — Test Suites: 28 passed, 28 total; Tests: 243 passed, 243 total |
| `pnpm --filter @platform/auth-service test` | PASS — Test Suites: 12 passed, 12 total; Tests: 52 passed, 52 total |
| `pnpm --filter @platform/auth-service build` (also run) | PASS — webpack compiled successfully |

## Connector allow-list mapping — risk resolved (per the plan's flag)

Confirmed against `connector-service/src/internal/internal.service.ts`: `/internal/tools` returns `{ tools: [{ name: "mcp__<provider>__<tool>", description, input_schema }] }` with **no separate catalog/connector-id field**. The only mapping signal is the `<provider>` segment in the namespaced name.

- **Built-in connectors**: `provider` IS the catalog connector id (e.g. `gmail`, `notion`). The filter matches exactly and safely against `allowedConnectors` (catalog ids).
- Implemented `filterByAllowedConnectors()` to extract the `<provider>` segment and keep only tools whose provider is in the allow-list. `null` => no filtering (inherit); `[]` => allow none.

### Deferral / documented limitation (NOT guessed — simpler safe subset implemented)
Custom MCP servers are namespaced `mcp__custom:<id>__<tool>`, so their provider segment is `custom:<id>` — **not a catalog id**. Since `allowedConnectors` holds catalog ids (and the admin UI can only pick catalog connectors), a custom MCP server can never appear in the allow-list and is therefore **dropped whenever a non-null AI allow-list is set**. This is the conservative/safe default (deny-by-default for the AI list). Allow-listing custom MCP servers (e.g. by exposing `custom:<id>` ids in the admin UI, or having connector-service return an explicit per-tool connector id) is deferred as a follow-up if required.

## Notes
- `apps/server/ai-service/src/ai/ai.service.ts` is 604 lines (over the ai-service 300-line soft limit). This was already the case before TASK-12; my edits added ~15 net lines threading settings. Left as-is to avoid an out-of-scope refactor of the core agentic loop.
- Web + Mobile clients (admin panel UI + i18n) are not part of this backend task — they consume the now-fixed `/admin/workspace` contract above.
