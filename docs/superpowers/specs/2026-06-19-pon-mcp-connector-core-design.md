# PON — MCP Connector Core (P1) — Design Spec

**Date:** 2026-06-19
**Status:** Approved (direction + architecture + UI)
**Owner:** Tran Phuc Khang
**Scope:** P1 of the PON AI-Assistant platform roadmap

---

## 1. Context & Goal

PON is evolving from a realtime chat app into an **AI-assistant platform**: the AI is
central, and users connect third-party tools so the assistant can *act* for them (schedule
via Calendar, write mail via Gmail, file notes into Notion) — all driven from chat messages.

The assistant already has an agentic loop (`ai.service.ts`, `MAX_ITER = 5`), static tools,
memory, RAG, and persona. **The missing core is the connection layer**: per-user OAuth to
third parties, encrypted token storage, and exposing those grants as *dynamic tools* the
agent can call.

P1 delivers that core as a **vertical slice**: framework + one real connector
(**Notion via remote MCP**) working end-to-end, plus the **Add custom MCP** path.

### Non-goals (later phases)
- P2 polish of UI beyond functional Integrations/Skills screens.
- P4 full Skills engine (we create the `user_skills` schema now, wire it later).
- P5 additional providers (Gmail, Calendar, Drive, Slack, GitHub) — replicate the framework.
- P6 group context awareness.

---

## 2. Architecture Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| MCP execution model | **Hybrid**: catalog connectors over **remote MCP** + user-added **custom MCP** | Least ops for popular tools; "bring your own" covers the long tail (like claude.ai connectors) |
| OAuth + token host | **New `connector-service` (NestJS, :3003)** | Clean separation from `auth-service` (marked complete); isolates credential handling from AI reasoning |
| Token storage | **AES-256-GCM encrypted, in Mongo `platform` db** | Reuse shared DB; encryption key from env, never stored with ciphertext |
| Agent integration | **Dynamic tools injected into existing agent loop** | No rewrite of `ai.service.ts`; extend `ToolRegistryService` with a dynamic source |
| First connector | **Notion (remote MCP, OAuth)** | Has a stable remote MCP; proves the full OAuth → vault → MCP → agent path |

---

## 3. New Service: `connector-service` (:3003, NestJS)

Location: `apps/server/connector-service/`

### Modules

| Module | Responsibility |
|---|---|
| `catalog` | Static registry of built-in connectors. Each entry: `id`, `name`, `icon`, `scopes[]`, `authType` (`oauth2`/`apikey`/`none`), `mcpUrl`, OAuth endpoints. Served via `GET /catalog`. |
| `oauth` | `GET /oauth/:provider/start?userId=` → returns provider authorize URL (state = signed `{userId,provider,nonce}`). `GET /oauth/:provider/callback` → exchange code → tokens → vault → redirect back to client. Token refresh on demand. |
| `vault` | `TokenVaultService`: `save(userId, provider, tokens)`, `get(userId, provider)` (decrypts, auto-refreshes if expired), `delete(...)`. AES-256-GCM with `CONNECTOR_VAULT_KEY` (32-byte, base64 env). |
| `connections` | `GET /connections?userId=` (list w/ status, never returns secrets), `DELETE /connections/:id`. CRUD for `custom_mcp_servers`: `POST /custom-mcp` (url, authType, credential), `POST /custom-mcp/discover` (connect + listTools preview). |
| `mcp` | `McpClientService`: connects to a remote MCP endpoint (Streamable HTTP / SSE) using the user's token (or custom credential). `listTools(userId, provider)` and `callTool(userId, provider, toolName, input)`. Connection pooling/caching per (userId, provider). |
| `internal` | Service-to-service API consumed by ai-service (guarded by `INTERNAL_API_KEY` header): `GET /internal/tools?userId=` → flattened tool definitions across all the user's active connections, namespaced `mcp__<provider>__<tool>`. `POST /internal/tools/call` → executes. |

### Tech
- `@modelcontextprotocol/sdk` (TS) for the MCP client.
- Mongoose for schemas (shared `platform` db, port 27018).
- Standard NestJS DTO + constructor injection + per-module structure (≤500 lines/file per clean-code rule).
- Swagger at `/api` like the other services.

### Config / env (`apps/server/connector-service/.env`)
```
PORT=3003
MONGO_URI=mongodb://localhost:27018/platform
CONNECTOR_VAULT_KEY=<base64 32 bytes>
INTERNAL_API_KEY=<shared secret with ai-service>
OAUTH_REDIRECT_BASE=http://localhost:3003
CLIENT_REDIRECT_URL=http://localhost:3000/integrations   # web deep-link back
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_MCP_URL=https://mcp.notion.com/sse
```

---

## 4. Data Model (Mongo, `platform` db)

```
user_connections {
  _id, userId, provider,            // 'notion' | 'gmail' | ... | 'custom:<id>'
  status,                            // 'active' | 'expired' | 'revoked'
  scopes: string[],
  mcpUrl,
  encryptedTokens: { iv, tag, data },// AES-256-GCM payload
  accountLabel,                      // e.g. email shown in UI
  createdAt, updatedAt, lastUsedAt
}

custom_mcp_servers {
  _id, userId, name, url,
  authType,                          // 'oauth2' | 'apikey' | 'none'
  encryptedCredential,               // nullable
  toolsPreview: [{name, description}],
  createdAt
}

user_skills {                        // schema created in P1, fully wired in P4
  _id, userId, skillId, enabled, updatedAt
}
```

---

## 5. Agent Integration (ai-service changes)

Minimal, additive — no rewrite of the loop.

1. **`McpConnectorClient` (new service in ai-service)** — HTTP client to connector-service
   `internal` API, with `INTERNAL_API_KEY`. Caches tool defs per-request.
2. **`ToolRegistryService` extended**:
   - `getDefinitions()` → `async getDefinitions(ctx)`: static defs **+** dynamic defs from
     `McpConnectorClient.getTools(ctx.userId)`.
   - `execute()`: if `toolName` starts with `mcp__`, delegate to
     `McpConnectorClient.callTool(ctx.userId, toolName, input)`; else existing switch.
3. **`ai.service.ts`**: `buildTools()` becomes async and receives `ctx` so dynamic tools are
   included. (One signature change; call site already inside `runAgenticLoop` where ctx exists.)

Tool naming: `mcp__<provider>__<tool>` (e.g. `mcp__notion__create_page`) to avoid collisions
with static tools and make traces readable.

Failure handling: if connector-service is down or a token is revoked, dynamic tools are
simply omitted (assistant degrades to static tools) and a single warning is logged — the
chat never hard-fails because an integration is offline.

---

## 6. UI / UX

Reference mockup (approved, dark-neon system, PON branding):
`scratchpad/newera-mockup.html` → artifact.

### Web (`apps/web`)
- Route `app/(main)/integrations/page.tsx` — connector gallery (catalog + connected state),
  Connect button → opens OAuth popup to connector-service, Manage/Disconnect.
- Custom MCP panel — URL + auth → Discover tools → Save.
- Route `app/(main)/skills/page.tsx` — skills list with toggles; each shows required connectors.
- TanStack Query for data, axios via `chatApi`-style instance pointed at connector-service
  (`NEXT_PUBLIC_CONNECTOR_URL`). Zustand only for auth. next-intl keys added.

### Flutter (`apps/client`) — sync rule
- `lib/features/integrations/ui/integrations_screen.dart` (mirror of web).
- `lib/features/skills/ui/skills_screen.dart`.
- Riverpod providers + Dio instance `connectorDio` (:3003). OAuth via in-app browser / deep link.
- i18n keys added to all 7 `app_*.arb` files.

### Sync contract
Both clients hit the same connector-service REST API and render the same connection states.
New strings added to web `messages/*.json` and mobile ARB together.

---

## 7. Testing

- **connector-service**: unit tests for `TokenVaultService` (encrypt/decrypt roundtrip,
  tamper detection), `McpClientService` (mock MCP server), oauth state signing. `pnpm test`.
- **ai-service**: `ToolRegistryService` dynamic merge + `mcp__` routing (mock McpConnectorClient).
- **web**: type-check + build.
- **Flutter**: `flutter analyze` clean, widget smoke test for integrations screen.
- **E2E manual**: connect Notion → message "create a Notion page titled X" → page appears.

---

## 8. Build Order (feeds the implementation plan)

1. Scaffold `connector-service` (Nest app, config, Mongo, swagger, health).
2. Schemas + `TokenVaultService` (+ tests).
3. `catalog` + `McpClientService` (+ tests).
4. `oauth` flow (Notion) + `connections` CRUD + custom MCP.
5. `internal` API for ai-service.
6. ai-service: `McpConnectorClient` + registry/buildTools wiring (+ tests).
7. Web Integrations + Skills screens.
8. Flutter Integrations + Skills screens + i18n.
9. Infra: add connector-service to docker-compose, `.env.example`, `pnpm connector` script.
10. QA: builds, sync-check, E2E Notion slice.

---

## 9. Risks

- **Remote MCP availability/contract** for Notion may differ from assumptions → isolate behind
  `McpClientService`; if Notion's remote MCP is unavailable, fall back to direct Notion API
  wrapped as a local MCP-shaped tool (same interface, swap impl).
- **Secret handling** — vault key must be 32 bytes; service refuses to boot otherwise.
- **CORS / OAuth redirect** across web (3000) ↔ connector (3003) — configure allowed origins.
