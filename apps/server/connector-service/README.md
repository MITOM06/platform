# connector-service

NestJS microservice (port **3003**) that lets each PON user connect third-party tools and exposes
them to the AI assistant as governed, per-user MCP tools. Part of the [PON](../../../README.md)
monorepo.

## Responsibility

- **Catalog** — registry of built-in connectors (Notion live; Gmail/Calendar/Drive planned) with
  their scopes, auth type, and MCP/REST endpoints. `GET /catalog`.
- **OAuth** — per-provider authorize + callback; exchanges the code and stores tokens.
  `GET /oauth/:provider/start`, `GET /oauth/:provider/callback`.
- **Token vault** — AES-256-GCM encryption of all third-party tokens (`CONNECTOR_VAULT_KEY`, 32 bytes).
- **MCP client / adapters** — talks to remote MCP servers (Notion, custom) and, for providers without
  a public MCP, a REST adapter (Google) — behind one `ProviderAdapter` interface.
- **Connections + custom MCP** — list/disconnect a user's connections; add/discover a custom MCP
  server (admin-only). `GET/DELETE /connections`, `POST /custom-mcp[/discover]`.
- **Internal tools API** — service-to-service (header `x-internal-key`) for ai-service:
  `GET /internal/tools?userId=` and `POST /internal/tools/call`. Tools are namespaced
  `mcp__<provider>__<tool>`.

## Governance (enterprise RBAC)

Identity comes from the verified JWT (`JwtAuthGuard`, shared `JWT_ACCESS_SECRET`) — never a query
param. Actions are gated by capability (from `@platform/database`):

- `ADD_CUSTOM_MCP` — custom MCP servers are admin-only.
- `CONNECT_PERSONAL_CONNECTOR` + the workspace `connectorAllowList` — personal connects.
- `CONNECT_WORKSPACE_CONNECTOR` — shared workspace connectors (usable by all members).
- `RUN_SENSITIVE_SKILL` — sensitive tools (send mail, external writes) are filtered from the tool
  list *and* blocked at execution if the member lacks it.

Connections carry `scope: 'workspace' | 'personal'`.

## Configuration

See `.env.example`. Key vars: `PORT`, `MONGO_URI` (shared `platform` db, port 27018),
`CONNECTOR_VAULT_KEY` (base64, 32 bytes — the service refuses to boot otherwise), `INTERNAL_API_KEY`
(must match ai-service), `JWT_ACCESS_SECRET` (identical across services), `OAUTH_REDIRECT_BASE`,
`CLIENT_REDIRECT_URL`, and per-provider OAuth creds (`NOTION_*`, `GOOGLE_*`).

```bash
# generate a vault key
openssl rand -base64 32
```

## Develop

```bash
pnpm --filter connector-service start:dev   # or: pnpm connector (from repo root)
pnpm --filter connector-service test
pnpm --filter connector-service build
```

Swagger UI at `http://localhost:3003/api`.

## Architecture notes

- `ai-service` calls the internal API during an AI request and merges the returned tools into its
  agentic loop; when the model calls one, ai-service proxies it back here for execution.
- Adding a connector with an official remote MCP = a catalog entry. Providers without one (e.g.
  Google) use the REST adapter — same `mcp__<provider>__<tool>` naming, so ai-service and the
  clients need no change.

See the design spec at `docs/superpowers/specs/2026-06-19-pon-mcp-connector-core-design.md`.
