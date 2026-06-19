# P5 — Gmail + Google Calendar Connectors Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. Steps use `- [ ]`.

**Goal:** Add working Gmail and Google Calendar connectors so the "Mail writer" and "Scheduler" skills act for real — via Google OAuth + a REST adapter exposed through the same internal tools API, with zero changes to ai-service or the clients.

**Architecture decision (locked):** Notion uses an official remote MCP; **Google has no equivalent public remote MCP**, so per spec §9 we introduce a `ProviderAdapter` abstraction in connector-service. `RemoteMcpAdapter` keeps the existing Notion/custom path; `GoogleRestAdapter` exposes static MCP-shaped tool defs and calls Google REST APIs with the user's OAuth bearer token (refreshing on expiry). Tool naming stays `mcp__gmail__*` / `mcp__calendar__*`, so the agent loop and both clients are unchanged. Clients are catalog-driven — flipping `available:true` makes the cards appear automatically.

**Tech Stack:** NestJS, Mongoose, `fetch`, Google OAuth2 + Gmail API v1 + Calendar API v3. All backend-only (`apps/server/connector-service/`).

## Global Constraints

- Single Google OAuth app for both connectors: env `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Google authorize URL MUST include `scope` (space-joined), `access_type=offline`, `prompt=consent` (to receive a `refresh_token`).
- Google token exchange uses `application/x-www-form-urlencoded` with client_id/secret in the body (NOT Basic auth, NOT JSON). Notion's existing Basic-auth + JSON path must keep working.
- Google access tokens expire (~1h): store `expires_in`/computed expiry; refresh via `refresh_token` and update the vault on 401 or pre-expiry, then retry once.
- Keep all 20 existing connector-service tests green. Max 500 lines/file. Commit per task with trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task P5-1: Generalize OAuth for Google + flip catalog entries

**Files:** `src/catalog/catalog.ts`, `src/oauth/oauth.service.ts`, `src/oauth/oauth.service.spec.ts`, `src/config/configuration.ts`, `.env.example`

**Interfaces:**
- `CatalogEntry` gains `adapter: 'remote-mcp' | 'google-rest'` (existing Notion + custom → `'remote-mcp'`).
- `CatalogOAuthConfig` gains optional `authStyle?: 'basic' | 'body'` (default `'basic'`), `bodyFormat?: 'json' | 'form'` (default `'json'`), `extraAuthorizeParams?: Record<string,string>`, `includeScope?: boolean`, `ownerParam?: boolean`.

- [ ] **Step 1:** Add the fields above. Flip `gmail` and `calendar` to `available:true`, `adapter:'google-rest'`, real scopes (gmail: `https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly`; calendar: `https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly`), and Google oauth config (`authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth'`, `tokenUrl:'https://oauth2.googleapis.com/token'`, `clientIdEnv:'GOOGLE_CLIENT_ID'`, `clientSecretEnv:'GOOGLE_CLIENT_SECRET'`, `authStyle:'body'`, `bodyFormat:'form'`, `includeScope:true`, `extraAuthorizeParams:{access_type:'offline',prompt:'consent'}`). Notion keeps `ownerParam:true`. Keep `drive` disabled. `mcpUrl:''` for Google (unused by the REST adapter).
- [ ] **Step 2:** Failing test: `buildAuthorizeUrl` for `gmail` includes `scope=`, `access_type=offline`, `prompt=consent`, and NO `owner`; for `notion` still includes `owner=user`. Run → FAIL.
- [ ] **Step 3:** Update `buildAuthorizeUrl` to honor `includeScope` (join `entry.scopes` with space), `extraAuthorizeParams`, and gate `owner=user` behind `ownerParam`. Update `exchangeCode` to honor `authStyle`/`bodyFormat`: when `'body'`+`'form'`, send `application/x-www-form-urlencoded` with `client_id`,`client_secret`,`grant_type`,`code`,`redirect_uri`; keep the Basic+JSON branch for Notion. Add `GOOGLE_CLIENT_ID/SECRET` to configuration + `.env.example`.
- [ ] **Step 4:** Run oauth + catalog tests → PASS (all existing green).
- [ ] **Step 5:** Commit: `feat(connector): generalize OAuth + enable Gmail/Calendar catalog entries`.

---

### Task P5-2: ProviderAdapter abstraction + RemoteMcpAdapter

**Files:** `src/adapters/provider-adapter.interface.ts`, `src/adapters/remote-mcp.adapter.ts`, `src/adapters/adapter-registry.service.ts`, `src/adapters/adapter.module.ts`, refactor `src/internal/internal.service.ts`, update `src/internal/internal.service.spec.ts`

**Interfaces:**
- `interface ConnectionLike { provider:string; mcpUrl?:string; encryptedTokens?:EncBlob; url?:string; authType?:string; encryptedCredential?:EncBlob; _id?:unknown }`
- `interface ProviderAdapter { listTools(conn: ConnectionLike): Promise<McpTool[]>; callTool(conn: ConnectionLike, tool: string, input: Record<string,unknown>): Promise<string> }`
- `AdapterRegistryService.forProvider(provider: string): ProviderAdapter` → `'custom:*'` and remote-mcp catalog entries → `RemoteMcpAdapter`; `google-rest` entries → `GoogleRestAdapter` (Task P5-3).

- [ ] **Step 1:** Define the interface. Implement `RemoteMcpAdapter` wrapping `McpClientService` + `TokenVaultService` (decrypt → bearer, exactly the current `authForConnection`/`authForType` logic).
- [ ] **Step 2:** Failing test: `AdapterRegistryService.forProvider('notion')` returns the remote-mcp adapter; `forProvider('gmail')` returns the google-rest adapter. Run → FAIL.
- [ ] **Step 3:** Implement `AdapterRegistryService`. Refactor `internal.service` `getTools`/`callTool`/`callBuiltin`/`callCustom` to resolve an adapter via the registry and delegate `listTools`/`callTool` to it (drop the direct `this.mcp.*` calls; keep `lastUsedAt` update and the `mcp__<provider>__<tool>` namespacing). Provide the registry in the internal module.
- [ ] **Step 4:** Run internal tests (updated mocks) → PASS; full suite green.
- [ ] **Step 5:** Commit: `refactor(connector): provider-adapter abstraction (remote-mcp path unchanged)`.

---

### Task P5-3: GoogleRestAdapter (Gmail + Calendar tools)

**Files:** `src/adapters/google-rest.adapter.ts`, `src/adapters/google-rest.adapter.spec.ts`, wire into `AdapterRegistryService`

**Interfaces:**
- `GoogleRestAdapter implements ProviderAdapter`. `listTools(conn)` returns static defs keyed by `conn.provider`:
  - gmail: `send_email{to,subject,body}`, `create_draft{to,subject,body}`, `search_threads{query,maxResults?}`
  - calendar: `list_events{timeMin?,timeMax?,maxResults?}`, `create_event{summary,start,end,attendees?,description?}`, `suggest_time{durationMins,attendees?,windowStart?,windowEnd?}`
- `callTool(conn,tool,input)` maps each tool to a Google REST call using a fresh bearer (see refresh below); returns a concise text summary (e.g. `Draft created: <id>` / `Event "<summary>" booked <start>`).

- [ ] **Step 1:** Failing test (mock `fetch` + a stub `TokenVaultService`/refresh): `listTools({provider:'gmail'})` returns the 3 gmail tools with the names above; `callTool({provider:'gmail'},'send_email',{to,subject,body})` POSTs to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with a base64url RFC-822 body and `Authorization: Bearer`. `callTool({provider:'calendar'},'create_event',...)` POSTs to `https://www.googleapis.com/calendar/v3/calendars/primary/events`. Run → FAIL.
- [ ] **Step 2:** Implement static tool defs + a `callTool` switch. Helper `accessToken(conn)`: decrypt tokens; if expired (compare stored expiry) or on a 401, POST `refresh_token` grant to `https://oauth2.googleapis.com/token`, re-encrypt + persist via the connections model, retry once. Gmail `send_email`/`create_draft` build an RFC-822 message and base64url-encode it; `search_threads` GETs `users/me/threads?q=`. Calendar `suggest_time` GETs freebusy / events and returns the first open slot of `durationMins`.
- [ ] **Step 3:** Run adapter test → PASS.
- [ ] **Step 4:** Wire `GoogleRestAdapter` into `AdapterRegistryService` for `google-rest` providers. Full suite green; `pnpm --filter connector-service build` exit 0.
- [ ] **Step 5:** Commit: `feat(connector): Google REST adapter (Gmail + Calendar tools)`.

---

### Task P5-4: Infra env + QA

**Files:** `infra/docker-compose/compose.yml` (connector-service env: `GOOGLE_CLIENT_ID/SECRET`), `infra/docker-compose/.env` (gitignored, add empty keys), `.env` (service, add empty keys)

- [ ] **Step 1:** Add `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}` / `GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}` to the connector-service compose env; add the (empty) keys to both env files; `docker compose config` clean.
- [ ] **Step 2:** `pnpm --filter connector-service test` (all pass) + `build` (exit 0). Confirm `GET /catalog` now lists gmail + calendar as `available:true`.
- [ ] **Step 3:** Commit: `chore(infra): Google OAuth env for connector-service` + update `_workspace/05_p1_mcp_connector_qa.md` with a P5 section (what's tested vs needs Google creds for live E2E).

## Self-Review
- Spec coverage: §"P5 additional providers" + §9 fallback → P5-1..P5-4. Clients unchanged (catalog-driven, entries pre-existed). ai-service unchanged (`mcp__` naming preserved).
- Live E2E (real Gmail send / Calendar booking) needs `GOOGLE_CLIENT_ID/SECRET` + a Google account → HARD STOP, documented, not run here.
