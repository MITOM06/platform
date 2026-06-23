## Feature: TASK-12 — Simple AI settings page (workspace-level)

### Summary
Give the single-tenant workspace ONE admin screen to tune the assistant without redeploying: default persona name/tone, default model tier, web-search & extended-thinking toggles, monthly token limit, and which MCP connectors are allowed. Settings persist on the **singleton `Workspace` document** (as a new typed `aiSettings` sub-document, owned by auth-service and edited via the existing `/admin/workspace` admin API gated by `MANAGE_WORKSPACE`). **ai-service reads the same `workspaces` document directly from the shared `platform` Mongo DB**, caches it in-memory, and busts the cache via a Redis pub/sub message published on every admin save — so a change takes effect on the **next AI request with no restart**. Env vars remain the fallback whenever a field is unset.

---

### KEY DECISIONS (resolved — not open)

**Decision 1 — Where settings live + how ai-service reads them (single source of truth).**
Settings live as a typed `Workspace.aiSettings` sub-document on the existing **singleton `Workspace`** doc (collection `workspaces`), owned by **auth-service**, edited through the **existing** `PATCH /admin/workspace` route. ai-service reads that same doc from the shared `platform` DB through a new read-only `SettingsModule` with an in-memory cache invalidated by Redis pub/sub.

- *Justification vs. the backlog's literal "new `ai_settings` collection":* PON is single-tenant; the `Workspace` doc is the established home for all workspace-level admin config (branding, `features`, `connectorAllowList`, `sso`). It already has `connectorAllowList` — duplicating it into a parallel `ai_settings` collection would create two sources of truth for the same governance data and a second admin surface. We deviate from the backlog's wording but honor its **intent** ("ai-service reads it, cached, instead of only env vars"): the AI settings are a cohesive `aiSettings` sub-document, ai-service reads it cached, env vars are the fallback. *(deviation noted)*
- *Why ai-service reads Mongo directly rather than calling auth-service:* the DB is shared (`platform`), ai-service already uses `@nestjs/mongoose`, and a per-request HTTP hop to auth-service on the hot path is avoided. ai-service holds a **read-only** model on the `workspaces` collection (it never writes it).
- *Cache + invalidation:* `SettingsService` caches the resolved settings (singleton, 60s TTL safety net) and **subscribes to a new Redis channel `ai:settings:invalidate`**; auth-service `updateWorkspace()` **publishes** to that channel after a successful save (only when the patch touches `aiSettings`). On message, ai-service drops its cache; the next request reloads. TTL is the fallback if a publish is ever missed.

**Decision 2 — Where the UI lives + what gates it.**
The UI lives in the **admin console** (web `/admin/ai` + Flutter admin panel), **not** the user settings page, because this is workspace-wide admin config that mirrors the existing Workspace/SSO panels. It is gated by the **existing `MANAGE_WORKSPACE`** capability (no new capability — same admin manages branding, connectors, SSO, and now AI). Both clients consume the **same contract**: they read/write `aiSettings` as part of the existing `GET/PATCH /admin/workspace` payload via the existing `adminService`/`AdminRepository`.

> Backlog said "reuse `apps/web/app/(main)/settings/`". We chose the admin console instead and justify it here: `settings/` is per-user (profile, theme, AI memory); workspace AI config is admin-scoped and belongs beside the other `MANAGE_WORKSPACE` panels. Per-conversation persona (an existing user-level feature) is unchanged and composes on top of these workspace defaults.

---

### Data Model Changes

Add a typed sub-document to the singleton Workspace schema (single source of truth, imported by auth-service AND ai-service).

`packages/database/src/mongo/workspace.schema.ts` — add `WorkspaceAiSettings` class + `aiSettings` prop (mirrors the existing `WorkspaceSso` pattern):

```ts
@NestSchema({ _id: false })
export class WorkspaceAiSettings {
  @Prop({ type: String, default: null })  personaName: string | null;        // default assistant name; null ⇒ env/"PON AI"
  @Prop({ type: String, default: null })  defaultTone: string | null;        // 'friendly'|'professional'|'concise'|'creative'; null ⇒ env/'friendly'
  @Prop({ type: String, default: null })  modelTier: string | null;          // 'auto'|'simple'|'mid'|'complex'; null/'auto' ⇒ env router
  @Prop({ type: Boolean, default: null }) webSearchEnabled: boolean | null;  // null ⇒ env WEB_SEARCH_ENABLED
  @Prop({ type: Boolean, default: null }) thinkingEnabled: boolean | null;   // null ⇒ env AI_ENABLE_THINKING
  @Prop({ type: Number,  default: null }) monthlyTokenLimit: number | null;  // null ⇒ env AI_MONTHLY_TOKEN_LIMIT
  // null = "no AI-specific restriction, fall back to Workspace.connectorAllowList";
  // [] = explicitly allow none; [...] = explicit AI allow-list (must be a subset of connectorAllowList)
  @Prop({ type: [String], default: null }) allowedConnectors: string[] | null;
}
export const WorkspaceAiSettingsSchema = SchemaFactory.createForClass(WorkspaceAiSettings);
```
On `Workspace`: `@Prop({ type: WorkspaceAiSettingsSchema, default: () => ({}) }) aiSettings: WorkspaceAiSettings;`

**`null` everywhere = "inherit env/default".** This is the explicit fallback contract: an unset field never overrides the env var. No data migration needed — Mongoose applies the default on next read/write; existing docs simply read `aiSettings = {}` ⇒ all-null ⇒ pure env behavior.

---

### API Contract (FIXED — both clients consume this identically)

No new endpoint. AI settings ride on the **existing** workspace admin contract.

**Endpoint:** `GET /admin/workspace` (auth-service, gated `MANAGE_WORKSPACE`)
- Response (additive): existing `Workspace` shape **plus**
  ```jsonc
  "aiSettings": {
    "personaName": "string | null",
    "defaultTone": "'friendly'|'professional'|'concise'|'creative' | null",
    "modelTier": "'auto'|'simple'|'mid'|'complex' | null",
    "webSearchEnabled": "boolean | null",
    "thinkingEnabled": "boolean | null",
    "monthlyTokenLimit": "number | null",
    "allowedConnectors": "string[] | null"
  }
  ```

**Endpoint:** `PATCH /admin/workspace` (auth-service, gated `MANAGE_WORKSPACE`)
- Request (additive, all optional): existing `UpdateWorkspaceDto` fields **plus** `aiSettings?: { ...same fields, each optional, each nullable }`
- Response: updated `Workspace` (including `aiSettings`).
- **Merge semantics (critical):** the service must **deep-merge** `aiSettings` onto the stored sub-doc, NOT `$set: dto` it (a raw `$set: { aiSettings: {...partial} }` would wipe unspecified fields). Build `{$set: {"aiSettings.personaName": ...}}` per provided key, or load-merge-save.
- **Validation:** `defaultTone ∈ VALID_TONES`; `modelTier ∈ {auto,simple,mid,complex}`; `monthlyTokenLimit ≥ 0`; `allowedConnectors` entries must exist in the connector catalog AND be a subset of `connectorAllowList` (reject otherwise with 400).
- **Side effect:** after a successful save whose patch included `aiSettings`, publish `PUBLISH ai:settings:invalidate "{\"reason\":\"workspace.update\"}"` on the shared `REDIS_CLIENT`.

**Redis cache-invalidation channel (NEW):** `ai:settings:invalidate` — publisher: auth-service; subscriber: ai-service `SettingsService`. Payload is opaque (any message busts the singleton cache).

---

### Backend (NestJS auth-service + NestJS ai-service)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `packages/database/src/mongo/workspace.schema.ts` | 수정 | Add `WorkspaceAiSettings` class + `WorkspaceAiSettingsSchema` + `aiSettings` prop. |
| `packages/database/src/index.ts` (or mongo barrel) | 수정 | Re-export `WorkspaceAiSettings`, `WorkspaceAiSettingsSchema` so ai-service can import the schema. |
| `apps/server/auth-service/src/modules/admin/dto/workspace.dto.ts` | 수정 | Add nested `WorkspaceAiSettingsDto` (class-validator: `@IsOptional`, `@IsIn(VALID_TONES)`, `@IsIn(['auto','simple','mid','complex'])`, `@IsBoolean`, `@IsInt @Min(0)`, `@IsArray @IsString({each:true})`, all nullable) + `@IsOptional @ValidateNested @Type(()=>WorkspaceAiSettingsDto) aiSettings?` on `UpdateWorkspaceDto`. |
| `apps/server/auth-service/src/modules/admin/admin.service.ts` | 수정 | In `updateWorkspace()`: deep-merge `aiSettings` (dot-path `$set` per provided key) instead of plain `$set: dto`; validate `allowedConnectors ⊆ connectorAllowList`; after save, if `dto.aiSettings` present, `redis.publish('ai:settings:invalidate', ...)`. Inject `@Inject(REDIS_CLIENT) Redis`. Audit `meta.changes` already covers it. |
| `apps/server/auth-service/src/modules/admin/admin.module.ts` | 수정 (필요 시) | `DatabaseRedisModule`/`REDIS_CLIENT` is `@Global` — likely already injectable into `AdminService`; verify. |
| `apps/server/ai-service/src/settings/workspace.schema.ts` | 신규 | Read-only Mongoose model mapped to collection `workspaces` (reuse shared `WorkspaceSchema` or a slim projection). ai-service NEVER writes this. |
| `apps/server/ai-service/src/settings/settings.service.ts` | 신규 | `getSettings(): Promise<ResolvedAiSettings>` — load singleton `workspaces` doc, resolve each field against env defaults (null ⇒ env), cache in-memory (singleton + 60s TTL). `invalidate()` clears cache. Exposes typed resolved values for the read-path. |
| `apps/server/ai-service/src/settings/settings-invalidator.service.ts` | 신규 | `OnApplicationBootstrap`: `SUBSCRIBE ai:settings:invalidate` on a dedicated `REDIS_SUBSCRIBER` connection; on message → `settingsService.invalidate()`. Mirrors `redis/redis-subscriber.service.ts` pattern. |
| `apps/server/ai-service/src/settings/settings.module.ts` | 신규 | Wire schema + services; export `SettingsService`. Import `RedisModule`, `MongooseModule.forFeature`. |
| `apps/server/ai-service/src/app.module.ts` | 수정 | Register `SettingsModule`. |
| `apps/server/ai-service/src/ai/ai.service.ts` | 수정 | Start of `processRequest()`: `const s = await settingsService.getSettings()`; thread `s` into context. (1) persona default: pass `s.personaName`/`s.defaultTone` into prompt build. (2) model tier: if `s.modelTier !== 'auto'/null`, force `selectedModel = routerConfig[s.modelTier+'Model']` and skip `selectModel`. (3) thinking: `enableThinking = s.thinkingEnabled` overrides env. (4) put `s.webSearchEnabled` + `s.allowedConnectors` onto `ToolContext`. Also add `webSearchEnabled?`/`allowedConnectors?` fields to the `ToolContext` interface. |
| `apps/server/ai-service/src/persona/persona.service.ts` | 수정 | `buildSystemPrompt(persona, displayName, defaults?)` — when per-conversation `persona` is null/missing a field, fall back to workspace `defaults.personaName`/`defaults.defaultTone` BEFORE the hardcoded `'PON AI'`/`'friendly'`. Per-conversation persona stays highest precedence. |
| `apps/server/ai-service/src/usage/usage.service.ts` | 수정 | `isQuotaExceeded(userId, limitOverride?)` — use resolved `monthlyTokenLimit` from settings; fall back to `config.quota.monthlyTokenLimit` when null. |
| `apps/server/ai-service/src/tools/tool-registry.service.ts` | 수정 | `getDefinitions(ctx)`: gate `web_search` on `ctx.webSearchEnabled !== false && webSearchService.isAvailable()` (composes with the TASK-09 provider-configured gate). Filter `mcp__*` tools by `ctx.allowedConnectors` when non-null (null ⇒ no extra filtering). |
| `apps/server/ai-service/src/config/configuration.ts` | 변경 없음 | Env vars remain the fallback layer; no new env needed. Singleton lookup is `findOne({})`. |

**Implementation note (connector id mapping):** MCP tool names are `mcp__<provider>__<tool>`. To filter by `allowedConnectors` (catalog connector ids), map a tool's `<provider>` segment to its catalog id; if the connector-service `/internal/tools` response carries a connector/catalog id per tool, filter on that. If absent, filter on the provider segment and document the limitation. *(confirm during impl)*

---

### Web (Next.js — admin console)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/lib/api/admin-types.ts` | 수정 | Add `WorkspaceAiSettings` interface (all fields nullable) to `Workspace` + `UpdateWorkspaceInput`. Single source of truth for the web client. |
| `apps/web/components/admin/WorkspaceAiSettings.tsx` | 신규 | Panel (mirror `WorkspaceSettings.tsx`): persona name input, tone `<Select>` (4 tones), model tier `<Select>` (auto/simple/mid/complex), web-search `<Switch>`, thinking `<Switch>`, monthly token limit number `<Input>`, connectors multi-select (from `useCatalog()`, constrained to `connectorAllowList`). Uses `useWorkspace()` + `useUpdateWorkspace()`. Save: `save.mutate({ aiSettings: {...} })`. ≤400 lines. |
| `apps/web/app/(main)/admin/ai/page.tsx` | 신규 | `<RequireCap cap="MANAGE_WORKSPACE"><WorkspaceAiSettings/></RequireCap>` (mirror `admin/workspace/page.tsx`). |
| `apps/web/components/admin/AdminShell.tsx` | 수정 | Add `{ href:'/admin/ai', cap:'MANAGE_WORKSPACE', labelKey:'navAi', icon: Sparkles }` to `ADMIN_SECTIONS`. |
| `apps/web/lib/hooks/use-admin.ts` | 변경 없음 | `useUpdateWorkspace` sends arbitrary `UpdateWorkspaceInput` and already invalidates `admin-workspace` + `me-capabilities` — reused as-is. |
| `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` | 수정 | Add `admin.navAi` + AI-settings labels/help/toasts under the `admin` namespace, all 7 locales. |

### Mobile (Flutter — admin panel)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/admin/data/admin_models.dart` | 수정 | Add `WorkspaceAiSettings` model (nullable fields) + parse/serialize inside `Workspace.fromJson`/`toJson`. |
| `apps/client/lib/features/admin/ui/panels/workspace_ai_settings_panel.dart` | 신규 | `WorkspaceAiSettingsPanel` (mirror `WorkspacePanel`): persona name field, tone dropdown, model-tier dropdown, web-search switch, thinking switch, token-limit field, connectors multi-select (catalog ∩ connectorAllowList). Reads `workspaceProvider`; saves via `workspaceProvider.notifier.save({'aiSettings': {...}})` (already invalidates `capabilitiesProvider`). Neon theme, ≤400 lines. |
| `apps/client/lib/features/admin/ui/admin_screen.dart` | 수정 | Add `_Section(Cap.manageWorkspace, Icons.auto_awesome, (c)=>c.l10n.adminNavAi, const WorkspaceAiSettingsPanel())` to `_sections()`. |
| `apps/client/lib/features/admin/data/admin_repository.dart` | 변경 없음 | `updateWorkspace(Map patch)` already PATCHes `/admin/workspace` via `authDio` — reused. |
| `apps/client/lib/l10n/app_en.arb` (template) → all `app_*.arb` (7) | 수정 | Add `adminNavAi` + AI-settings labels/help keys to `app_en.arb` first, then all 7 locales; run `flutter gen-l10n`. |

---

### Implementation Order
1. **Shared schema first (blocking):** `packages/database` — add `WorkspaceAiSettings` + export; build `@platform/database`. Both backends depend on this.
2. **Backend auth-service:** DTO + `updateWorkspace` deep-merge/validate/publish. (`pnpm --filter auth-service build && test`)
3. **Backend ai-service:** `SettingsModule` (schema + service + invalidator) → wire into `ai.service` read-path, `persona`, `usage`, `tool-registry`, `ToolContext`. (`pnpm build && pnpm test`)
4. **Web + Mobile in parallel** (both consume the now-fixed `/admin/workspace` contract; no inter-dependency): web panel/route/nav + i18n; Flutter panel/model/nav + ARB + `flutter gen-l10n`.
5. **Verify:** ai-service `pnpm build && pnpm test`; auth-service build+test; web `pnpm build`; `flutter analyze`. Manual acceptance: change tone / toggle web-search in admin UI → next AI message reflects it **without restart**.

---

### Edge Cases
- **No Workspace doc yet (fresh deploy):** `findOne({})` returns null ⇒ `SettingsService` resolves every field to env defaults (current behavior preserved).
- **Partial PATCH wiping siblings:** MUST deep-merge `aiSettings` (dot-path `$set`), never replace the whole sub-doc.
- **Redis publish missed / Redis down:** 60s cache TTL is the safety net; settings converge within a minute even if the invalidation message is lost.
- **Stale prompt cache:** a persona/tone change alters the cached system prefix → natural Anthropic prompt-cache miss; in-flight requests aren't retroactively affected (acceptable — "next request" is the contract).
- **`modelTier` forced + KB context:** explicit tier overrides the router's "KB ⇒ complex" rule; `'auto'` restores router behavior. Document it.
- **`allowedConnectors` not ⊆ `connectorAllowList`:** reject at PATCH (400) — the workspace allow-list is the outer boundary; the AI list can only narrow it.
- **`allowedConnectors: []` vs `null`:** `[]` = AI may use NO connectors (static tools/web_search still apply); `null` = inherit `connectorAllowList`. UI MUST distinguish "none" from "inherit".
- **monthlyTokenLimit = 0:** `null` ⇒ env fallback; explicit `0` ⇒ "block all" (`used >= 0` exceeds). Validate `≥ 0`.
- **i18n:** missing locale keys fall back to English (still builds) but all 7 must be added per `.claude/rules/i18n.md`.
- **Cross-platform parity (sync.md):** web and Flutter panels must expose the identical field set and write the identical `aiSettings` shape; a field on one client only is a P1.
