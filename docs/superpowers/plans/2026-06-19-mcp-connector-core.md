# MCP Connector Core (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each PON user OAuth-connect third-party tools (Notion first) and add custom MCP servers, then have the AI assistant call those tools from chat — proved end-to-end as a vertical slice.

**Architecture:** New `connector-service` (NestJS, :3003) owns OAuth, an AES-256-GCM token vault, an MCP client, and an internal API. `ai-service` fetches per-user dynamic tools from that internal API and merges them into its existing agentic loop. Web + Flutter get Integrations & Skills screens hitting the same REST API.

**Tech Stack:** NestJS 10, Mongoose (Mongo `platform` @27018), `@modelcontextprotocol/sdk`, Anthropic SDK (existing), Next.js App Router + TanStack Query, Flutter + Riverpod + Dio. pnpm / Maven / flutter pub.

## Global Constraints

- MongoDB db name: `platform`, port **27018** (non-standard).
- JWT env var `JWT_ACCESS_SECRET` identical across services; connector-service validates user JWTs the same way ai-service does.
- connector-service port **3003**; web env `NEXT_PUBLIC_CONNECTOR_URL`; Flutter `connectorDio` base.
- Internal ai-service ↔ connector-service calls carry header `x-internal-key: <INTERNAL_API_KEY>`.
- Encrypted token blobs never leave the service; list/CRUD endpoints return status + metadata only, never secrets.
- Dynamic tool naming: `mcp__<provider>__<tool>`.
- Max file length: backend 500 lines, Flutter/web 400 lines (clean-code rule).
- i18n: every new UI string added to web `messages/*.json` AND all 7 Flutter `app_*.arb`.
- Do NOT modify `apps/server/auth-service/` for this work.
- Vault key `CONNECTOR_VAULT_KEY` must decode to exactly 32 bytes; service refuses to boot otherwise.

---

## Phase A — connector-service core (backend)

### Task A1: Scaffold connector-service

**Files:**
- Create: `apps/server/connector-service/package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`
- Create: `apps/server/connector-service/src/main.ts`, `src/app.module.ts`, `src/config/configuration.ts`
- Create: `apps/server/connector-service/src/health/health.controller.ts`

**Interfaces:**
- Produces: a bootable Nest app on `PORT` (default 3003) with `GET /health` → `{status:'ok'}` and Mongoose connected to `MONGO_URI`.

- [ ] **Step 1:** Copy `package.json`/`tsconfig.json`/`nest-cli.json` shape from `apps/server/ai-service`, rename to `connector-service`, deps: `@nestjs/common @nestjs/core @nestjs/config @nestjs/mongoose mongoose @nestjs/swagger @modelcontextprotocol/sdk`, dev: `jest ts-jest @types/jest`.
- [ ] **Step 2:** `configuration.ts` reads `PORT, MONGO_URI, CONNECTOR_VAULT_KEY, INTERNAL_API_KEY, JWT_ACCESS_SECRET, OAUTH_REDIRECT_BASE, CLIENT_REDIRECT_URL` and all `NOTION_*`. On load, assert `Buffer.from(CONNECTOR_VAULT_KEY,'base64').length === 32` else `throw new Error('CONNECTOR_VAULT_KEY must be 32 bytes')`.
- [ ] **Step 3:** `app.module.ts` imports `ConfigModule.forRoot({isGlobal:true, load:[configuration]})` and `MongooseModule.forRootAsync` from config. `main.ts` enables CORS for `CLIENT_REDIRECT_URL` origin, sets up Swagger at `/api`, listens on `PORT`.
- [ ] **Step 4:** `health.controller.ts`: `@Get('health')` returns `{status:'ok'}`.
- [ ] **Step 5:** Run `pnpm --filter connector-service build` → expected: compiles. Start, `curl localhost:3003/health` → `{"status":"ok"}`.
- [ ] **Step 6:** Commit: `feat(connector): scaffold connector-service on :3003`.

---

### Task A2: TokenVaultService (encryption core)

**Files:**
- Create: `apps/server/connector-service/src/vault/token-vault.service.ts`
- Create: `apps/server/connector-service/src/vault/vault.module.ts`
- Test: `apps/server/connector-service/src/vault/token-vault.service.spec.ts`

**Interfaces:**
- Produces: `class TokenVaultService { encrypt(plain: string): EncBlob; decrypt(blob: EncBlob): string }` where `interface EncBlob { iv: string; tag: string; data: string }` (all base64). Uses `aes-256-gcm` with key from `CONNECTOR_VAULT_KEY`.

- [ ] **Step 1: Write failing test**
```ts
describe('TokenVaultService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const svc = new TokenVaultService({ get: () => key } as any);
  it('round-trips a secret', () => {
    const blob = svc.encrypt('refresh-token-xyz');
    expect(blob.data).not.toContain('refresh-token-xyz');
    expect(svc.decrypt(blob)).toBe('refresh-token-xyz');
  });
  it('rejects tampered ciphertext', () => {
    const blob = svc.encrypt('secret');
    expect(() => svc.decrypt({ ...blob, tag: Buffer.alloc(16).toString('base64') })).toThrow();
  });
});
```
- [ ] **Step 2:** Run `pnpm --filter connector-service test token-vault` → FAIL (no class).
- [ ] **Step 3: Implement**
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface EncBlob { iv: string; tag: string; data: string }
@Injectable()
export class TokenVaultService {
  private readonly key: Buffer;
  constructor(cfg: ConfigService) {
    this.key = Buffer.from(cfg.get<string>('CONNECTOR_VAULT_KEY')!, 'base64');
  }
  encrypt(plain: string): EncBlob {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
  }
  decrypt(b: EncBlob): string {
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(b.iv, 'base64'));
    d.setAuthTag(Buffer.from(b.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(b.data, 'base64')), d.final()]).toString('utf8');
  }
}
```
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit: `feat(connector): AES-256-GCM token vault`.

---

### Task A3: Schemas (connections, custom MCP, skills)

**Files:**
- Create: `apps/server/connector-service/src/connections/schemas/user-connection.schema.ts`
- Create: `apps/server/connector-service/src/connections/schemas/custom-mcp-server.schema.ts`
- Create: `apps/server/connector-service/src/connections/schemas/user-skill.schema.ts`

**Interfaces:**
- Produces: Mongoose schemas `UserConnection`, `CustomMcpServer`, `UserSkill` matching spec §4. `UserConnection.encryptedTokens` typed as `{ iv:string; tag:string; data:string }`. Index `{userId:1, provider:1}` unique on UserConnection.

- [ ] **Step 1:** Write `UserConnection` schema: fields `userId, provider, status('active'|'expired'|'revoked'), scopes[], mcpUrl, encryptedTokens(EncBlob subdoc), accountLabel, lastUsedAt`, `timestamps:true`, unique compound index.
- [ ] **Step 2:** Write `CustomMcpServer`: `userId, name, url, authType('oauth2'|'apikey'|'none'), encryptedCredential(EncBlob, optional), toolsPreview[{name,description}]`, timestamps.
- [ ] **Step 3:** Write `UserSkill`: `userId, skillId, enabled(bool)`, unique `{userId,skillId}`.
- [ ] **Step 4:** Register all three via `MongooseModule.forFeature` in a `ConnectionsModule`.
- [ ] **Step 5:** Build → compiles. Commit: `feat(connector): mongo schemas for connections/custom-mcp/skills`.

---

### Task A4: Connector catalog

**Files:**
- Create: `apps/server/connector-service/src/catalog/catalog.ts` (data), `src/catalog/catalog.controller.ts`, `src/catalog/catalog.module.ts`
- Test: `apps/server/connector-service/src/catalog/catalog.controller.spec.ts`

**Interfaces:**
- Produces: `interface CatalogEntry { id; name; icon; description; scopes:string[]; authType:'oauth2'|'apikey'|'none'; mcpUrl:string; oauth?:{authorizeUrl;tokenUrl;clientIdEnv;clientSecretEnv} }` and `GET /catalog` → `CatalogEntry[]` (without secret env values — strip `oauth` internals, expose only `authType`).

- [ ] **Step 1: Failing test** — `GET /catalog` returns array containing an entry `{id:'notion', authType:'oauth2'}` and the response JSON must NOT contain the substring `clientSecretEnv`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `catalog.ts` with Notion entry (real `mcpUrl` from `NOTION_MCP_URL`, oauth authorize/token URLs, `clientIdEnv:'NOTION_CLIENT_ID'`). Add placeholder-disabled stubs (commented config) for gmail/calendar/drive marked `available:false` so they show as "coming" — but only Notion `available:true` in P1. Controller maps entries → public DTO (drops `oauth` internals).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(connector): connector catalog + GET /catalog`.

---

### Task A5: McpClientService

**Files:**
- Create: `apps/server/connector-service/src/mcp/mcp-client.service.ts`, `src/mcp/mcp.module.ts`
- Test: `apps/server/connector-service/src/mcp/mcp-client.service.spec.ts`

**Interfaces:**
- Consumes: `@modelcontextprotocol/sdk` Client + StreamableHTTP/SSE transport.
- Produces: `class McpClientService { listTools(url:string, auth:McpAuth): Promise<McpTool[]>; callTool(url:string, auth:McpAuth, name:string, input:Record<string,unknown>): Promise<string> }` where `McpTool = {name; description; inputSchema:object}` and `McpAuth = {type:'bearer'|'apikey'|'none'; token?:string}`. Connections cached by `url+token` hash; `close()` on module destroy.

- [ ] **Step 1: Failing test** with a mock transport: `listTools` maps SDK `tools` → `McpTool[]`; `callTool` returns the text content joined. Use a fake Client injected via a protected `createClient()` seam the test overrides.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: `createClient(url,auth)` builds `new Client(...)` over Streamable HTTP transport with `Authorization: Bearer <token>` header when `auth.type==='bearer'`; cache by key; `listTools()` → `client.listTools()`; `callTool()` → `client.callTool({name,arguments:input})`, flatten `content[].text`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(connector): MCP client (list/call tools over remote MCP)`.

---

### Task A6: OAuth flow (Notion)

**Files:**
- Create: `apps/server/connector-service/src/oauth/oauth.service.ts`, `src/oauth/oauth.controller.ts`, `src/oauth/oauth.module.ts`
- Test: `apps/server/connector-service/src/oauth/oauth.service.spec.ts`

**Interfaces:**
- Consumes: catalog entry oauth config, `TokenVaultService`, `UserConnection` model.
- Produces: `GET /oauth/:provider/start?userId=` → `{authorizeUrl}`; `GET /oauth/:provider/callback?code=&state=` → exchanges code, saves encrypted tokens to `UserConnection`, redirects to `CLIENT_REDIRECT_URL?connected=<provider>`. `OAuthService.signState/verifyState` HMAC with `INTERNAL_API_KEY`.

- [ ] **Step 1: Failing test** for `signState({userId:'u1',provider:'notion'})` → `verifyState` returns same payload; a tampered state throws.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement state HMAC (sha256), `buildAuthorizeUrl(entry,state)`, `exchangeCode(entry,code)` (POST tokenUrl, basic auth from env), `persist(userId,provider,tokens,entry)` (encrypt via vault, upsert UserConnection status `active`, store `accountLabel` from token response if present).
- [ ] **Step 4:** Controller wires endpoints; callback verifies state, exchanges, persists, 302 redirect.
- [ ] **Step 5:** Run test → PASS. Build.
- [ ] **Step 6:** Commit: `feat(connector): Notion OAuth start/callback + token persistence`.

---

### Task A7: Connections + custom MCP CRUD

**Files:**
- Create: `apps/server/connector-service/src/connections/connections.controller.ts`, `connections.service.ts`, `dto/*.ts`
- Test: `apps/server/connector-service/src/connections/connections.service.spec.ts`

**Interfaces:**
- Produces: `GET /connections?userId=` → `ConnectionView[] = {id,provider,status,scopes,accountLabel,lastUsedAt}` (no secrets); `DELETE /connections/:id`; `POST /custom-mcp` (body `{name,url,authType,credential?}` → encrypts credential, saves); `POST /custom-mcp/discover` (body `{url,authType,credential?}` → calls `McpClientService.listTools`, returns `{tools:[{name,description}]}` WITHOUT saving).

- [ ] **Step 1: Failing test** — `listConnections` never returns `encryptedTokens`; `discover` delegates to `McpClientService.listTools` (mock) and returns its tool names.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement service mapping docs → `ConnectionView`, custom-mcp encrypt-credential save, discover via mcp client. DTOs with `class-validator`.
- [ ] **Step 4:** Run → PASS. Build.
- [ ] **Step 5:** Commit: `feat(connector): connections list/delete + custom MCP add/discover`.

---

### Task A8: Internal tools API (for ai-service)

**Files:**
- Create: `apps/server/connector-service/src/internal/internal.controller.ts`, `internal.service.ts`, `internal-key.guard.ts`
- Test: `apps/server/connector-service/src/internal/internal.service.spec.ts`

**Interfaces:**
- Consumes: `UserConnection`/`CustomMcpServer` models, `TokenVaultService`, `McpClientService`.
- Produces (guarded by `x-internal-key`): `GET /internal/tools?userId=` → `{tools: Array<{name:'mcp__<provider>__<tool>'; description; input_schema}>}` aggregated across the user's active connections + custom servers; `POST /internal/tools/call` body `{userId,name,input}` → `{result:string}`. Name parsing: split on `mcp__` → `<provider>` + `<tool>`; resolve connection → decrypt token → `McpClientService.callTool`. Updates `lastUsedAt`.

- [ ] **Step 1: Failing test** — `InternalKeyGuard` rejects missing/wrong header (403), allows correct. `getTools('u1')` namespaces each MCP tool as `mcp__notion__<tool>`; `callTool` parses the name and dispatches to the right connection.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement guard (compare `x-internal-key` to `INTERNAL_API_KEY`), service aggregation (for each active connection: vault.decrypt → mcp.listTools → map names), call dispatch (parse provider, load connection, decrypt, mcp.callTool).
- [ ] **Step 4:** Run → PASS. Build.
- [ ] **Step 5:** Commit: `feat(connector): internal tools API for ai-service`.

---

## Phase B — ai-service wiring

### Task B1: McpConnectorClient

**Files:**
- Create: `apps/server/ai-service/src/tools/mcp-connector.client.ts`
- Modify: `apps/server/ai-service/src/config/configuration.ts` (add `CONNECTOR_INTERNAL_URL`, `INTERNAL_API_KEY`)
- Test: `apps/server/ai-service/src/tools/mcp-connector.client.spec.ts`

**Interfaces:**
- Produces: `class McpConnectorClient { getTools(userId:string): Promise<ToolDefinition[]>; callTool(userId:string, name:string, input:Record<string,unknown>): Promise<string> }`. Uses `fetch` to connector internal API with `x-internal-key`. On any network error: `getTools` returns `[]` and logs a warning (never throws); `callTool` returns `Tool error: connector unavailable`.

- [ ] **Step 1: Failing test** — mock `fetch`: `getTools` maps response `tools` → `ToolDefinition[]`; a rejected fetch makes `getTools` resolve to `[]`.
- [ ] **Step 2:** Run `pnpm --filter ai-service test mcp-connector` → FAIL.
- [ ] **Step 3:** Implement with `fetch`, 5s `AbortController` timeout, try/catch returning `[]`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(ai): MCP connector client (graceful-degrade)`.

---

### Task B2: Merge dynamic tools into registry + loop

**Files:**
- Modify: `apps/server/ai-service/src/tools/tool-registry.service.ts`
- Modify: `apps/server/ai-service/src/ai/ai.service.ts:244` (`buildTools`) and call site ~`:281`
- Modify: `apps/server/ai-service/src/tools/tools.module.ts` (provide `McpConnectorClient`)
- Test: extend `apps/server/ai-service/src/tools/tool-registry.service.spec.ts`

**Interfaces:**
- Consumes: `McpConnectorClient` from B1.
- Produces: `ToolRegistryService.getDefinitions(ctx: ToolContext): Promise<ToolDefinition[]>` = static defs + `mcpConnector.getTools(ctx.userId)`. `execute(name, input, ctx)`: if `name.startsWith('mcp__')` → `mcpConnector.callTool(ctx.userId, name, input)`, else existing switch. `ai.service.buildTools(ctx)` becomes async.

- [ ] **Step 1: Failing test** — `getDefinitions(ctx)` includes a mocked dynamic tool `mcp__notion__create_page`; `execute('mcp__notion__create_page',{},ctx)` calls `mcpConnector.callTool`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Inject `McpConnectorClient` into registry; make `getDefinitions` async merging dynamic defs; add `mcp__` branch to `execute`. Update `ai.service.ts`: `buildTools` → `async buildTools(ctx)`, await it where `const tools = this.buildTools()` is called (ctx already built just above).
- [ ] **Step 4:** Run registry test + existing ai.service tests → PASS.
- [ ] **Step 5:** Commit: `feat(ai): inject per-user MCP tools into agent loop`.

---

## Phase C — Web (Next.js)

### Task C1: Connector API client + types

**Files:**
- Create: `apps/web/lib/api/connector.ts` (axios instance for `NEXT_PUBLIC_CONNECTOR_URL`), `apps/web/lib/api/connector-types.ts`
- Modify: `apps/web/.env.example` (+`NEXT_PUBLIC_CONNECTOR_URL=http://localhost:3003`)

**Interfaces:**
- Produces: `connectorApi` axios instance (JWT interceptor like `chatApi`); types `CatalogEntry`, `ConnectionView`, `CustomMcpInput` mirroring backend DTOs in `lib/api/types.ts` style.

- [ ] **Step 1:** Create axios instance mirroring `lib/api/axios.ts` pattern; attach auth token from Zustand store.
- [ ] **Step 2:** Define types matching A4/A7 DTOs.
- [ ] **Step 3:** Build (`pnpm --filter web build`) → compiles. Commit: `feat(web): connector-service api client + types`.

---

### Task C2: Integrations page

**Files:**
- Create: `apps/web/app/(main)/integrations/page.tsx`, `apps/web/components/integrations/ConnectorCard.tsx`, `CustomMcpPanel.tsx`
- Modify: `apps/web/messages/en.json` (+ all locale json) — keys `integrations.*`

**Interfaces:**
- Consumes: `connectorApi`, catalog + connections queries (TanStack Query).
- Produces: `/integrations` route rendering catalog gallery (matching mockup), Connect → opens `GET /oauth/:provider/start` URL in popup; on `?connected=` return, invalidate connections query; Disconnect → `DELETE /connections/:id`. CustomMcpPanel: URL+auth → `POST /custom-mcp/discover` preview → `POST /custom-mcp`.

- [ ] **Step 1:** `ConnectorCard.tsx` (≤400 lines) — props `{entry, connection?}`, renders icon/name/scopes/status + Connect/Manage button.
- [ ] **Step 2:** `CustomMcpPanel.tsx` — form with discover + save.
- [ ] **Step 3:** `page.tsx` (`'use client'`) — `useQuery` catalog + connections; grid of cards; wire popup OAuth + invalidation.
- [ ] **Step 4:** Add `integrations.*` i18n keys to ALL locale files under `apps/web/messages/`.
- [ ] **Step 5:** Build → compiles. Manual: page renders gallery. Commit: `feat(web): integrations screen (connect/disconnect/custom MCP)`.

---

### Task C3: Skills page

**Files:**
- Create: `apps/web/app/(main)/skills/page.tsx`, `apps/web/components/integrations/SkillToggle.tsx`
- Modify: locale json — keys `skills.*`

**Interfaces:**
- Produces: `/skills` route listing skills (static skill defs file `apps/web/lib/skills.ts` = `{id,name,desc,requires:string[]}`), each with a toggle persisting via connector `user_skills` (add `GET/PUT /skills?userId=` to A7 service if not present — note: add endpoint in this task’s backend touch). Shows required connectors per skill.

- [ ] **Step 1:** Add `GET /skills?userId=` + `PUT /skills` to `connections.service.ts`/controller (UserSkill upsert). Test the upsert.
- [ ] **Step 2:** `lib/skills.ts` static defs (Scheduler, Mail writer, Researcher, Project keeper — matching mockup).
- [ ] **Step 3:** `SkillToggle.tsx` + `page.tsx` with TanStack Query mutation on toggle.
- [ ] **Step 4:** i18n `skills.*` to all locale files.
- [ ] **Step 5:** Build → compiles. Commit: `feat(web): skills selector screen`.

---

## Phase D — Flutter (mirror, sync rule)

### Task D1: Connector repository + models

**Files:**
- Create: `apps/client/lib/features/integrations/data/connector_repository.dart`, `models/connector_models.dart`
- Modify: `apps/client/lib/core/network/dio_providers.dart` (add `connectorDio` :3003) and `AppConfig`

**Interfaces:**
- Produces: `connectorDio` (base `AppConfig.connectorBaseUrl`, JWT interceptor); `ConnectorRepository` with `catalog()`, `connections()`, `startOAuth(provider)`, `disconnect(id)`, `discoverCustom(...)`, `saveCustom(...)`; freezed/plain models mirroring backend DTOs.

- [ ] **Step 1:** Add `connectorBaseUrl` to `AppConfig`; create `connectorDio` provider mirroring `chatDio`.
- [ ] **Step 2:** Models + repository methods.
- [ ] **Step 3:** `flutter analyze` clean. Commit: `feat(mobile): connector repository + connectorDio`.

---

### Task D2: Integrations screen

**Files:**
- Create: `apps/client/lib/features/integrations/ui/integrations_screen.dart`, `widgets/connector_card.dart`, `widgets/custom_mcp_sheet.dart`
- Create: `apps/client/lib/features/integrations/state/integrations_provider.dart`
- Modify: `apps/client/lib/l10n/app_en.arb` + all 6 other ARB files (keys `integrations*`); router registration

**Interfaces:**
- Consumes: `ConnectorRepository`.
- Produces: neon-themed screen mirroring web; Connect opens OAuth URL via in-app browser / `url_launcher`, deep-link back refreshes; Disconnect; custom MCP bottom sheet (discover→save). Riverpod `AsyncNotifier` for connections.

- [ ] **Step 1:** `integrations_provider.dart` AsyncNotifier loading catalog+connections.
- [ ] **Step 2:** `connector_card.dart` (≤400 lines) neon card.
- [ ] **Step 3:** `custom_mcp_sheet.dart` discover+save.
- [ ] **Step 4:** `integrations_screen.dart` assembling list; register route + entry in settings/nav.
- [ ] **Step 5:** Add `integrations*` keys to ALL 7 ARB files; run `flutter gen-l10n`.
- [ ] **Step 6:** `flutter analyze` clean; widget smoke test. Commit: `feat(mobile): integrations screen`.

---

### Task D3: Skills screen

**Files:**
- Create: `apps/client/lib/features/skills/ui/skills_screen.dart`, `state/skills_provider.dart`, `data/skill_defs.dart`
- Modify: all 7 ARB files (keys `skills*`); router

**Interfaces:**
- Produces: skills list with toggles persisting via `ConnectorRepository.setSkill(id,enabled)` (add to repo, hits `PUT /skills`); shows required connectors. Mirror of web C3.

- [ ] **Step 1:** `skill_defs.dart` static defs matching web `lib/skills.ts`.
- [ ] **Step 2:** `skills_provider.dart` + repo `getSkills/setSkill`.
- [ ] **Step 3:** `skills_screen.dart` neon toggles; route registration.
- [ ] **Step 4:** `skills*` keys to ALL ARB; `flutter gen-l10n`.
- [ ] **Step 5:** `flutter analyze` clean. Commit: `feat(mobile): skills selector screen`.

---

## Phase E — Infra & QA

### Task E1: Infra wiring

**Files:**
- Modify: `infra/docker-compose/compose.yml` (add connector-service), root `package.json` (`"connector": "pnpm --filter connector-service start:dev"`)
- Create: `apps/server/connector-service/.env` (dev values; generate a real 32-byte `CONNECTOR_VAULT_KEY` via `openssl rand -base64 32`)

- [ ] **Step 1:** Add compose service `connector-service` (build context, env_file, ports `3003:3003`, depends_on mongo/redis).
- [ ] **Step 2:** Add `pnpm connector` script; generate vault key into `.env` (gitignored).
- [ ] **Step 3:** `docker compose config` validates. Commit: `chore(infra): wire connector-service (compose + scripts)`.

---

### Task E2: QA + E2E Notion slice

- [ ] **Step 1:** Run all builds/tests: `pnpm --filter connector-service test && pnpm --filter ai-service test && pnpm --filter web build`; `cd apps/client && flutter analyze`.
- [ ] **Step 2:** Run `sync-check` skill — verify Integrations + Skills exist on both clients, same API, i18n keys present in web + all ARB.
- [ ] **Step 3:** Manual E2E: start infra + all services; on web `/integrations` connect Notion (real OAuth); in chat send "Create a Notion page titled 'PON test'"; verify the agent calls `mcp__notion__create_page` and the page appears in Notion.
- [ ] **Step 4:** Document results in `_workspace/` report. Commit: `test(connector): P1 QA + Notion E2E verified`.

---

## Self-Review

- **Spec coverage:** §3 modules → A1–A8; §4 data model → A3; §5 agent integration → B1–B2; §6 UI → C1–C3 (web), D1–D3 (Flutter); §7 testing → tests in each task + E2; §8 build order → Phases A–E in order. `user_skills` schema (A3) created in P1, wired by C3/D3 — matches spec "created now, fully wired P4" (we wire the basic persistence early since the screen needs it).
- **Placeholder scan:** Core backend tasks carry real code; UI tasks specify exact files, components, endpoints, and i18n obligations — no "TBD".
- **Type consistency:** `EncBlob`, `ToolDefinition`, `ConnectionView`, `CatalogEntry`, `McpTool/McpAuth`, tool naming `mcp__<provider>__<tool>` used consistently across A2/A3/A5/A7/A8/B1/B2.
- **Note:** C3 adds `GET/PUT /skills` to the connector connections service — folded into C3 Step 1 rather than a separate backend task since it is a thin upsert the skills screen depends on.
