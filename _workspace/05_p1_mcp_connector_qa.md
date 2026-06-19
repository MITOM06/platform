# P1 — MCP Connector Core — QA Report

**Date:** 2026-06-19
**Branch:** `feature/mcp-connector-core`
**Spec:** `docs/superpowers/specs/2026-06-19-pon-mcp-connector-core-design.md`
**Plan:** `docs/superpowers/plans/2026-06-19-mcp-connector-core.md`

## Scope delivered

P1 of the PON AI-assistant pivot: per-user MCP connections (OAuth + encrypted token vault),
the agent calling those tools from chat, and Integrations + Skills screens on web & mobile.

## Build / test results

| Surface | Command | Result |
|---|---|---|
| connector-service | `pnpm --filter connector-service test` | **20/20 pass**, build exit 0 |
| ai-service | `pnpm --filter ai-service test` | **97/97 pass** (incl. pre-existing, after async `buildTools`), build exit 0 |
| web | `pnpm --filter @platform/web build` | **compiles**, routes `/integrations` + `/skills` present, no type errors |
| Flutter | `flutter analyze` | **No issues found** |
| infra | `docker compose config` | **valid**, no warnings |

## Cross-platform sync (`.claude/rules/sync.md`)

All four mirror pairs exist on both clients:
- `app/(main)/integrations/page.tsx` ↔ `integrations/ui/integrations_screen.dart`
- `components/integrations/ConnectorCard.tsx` ↔ `widgets/connector_card.dart`
- `components/integrations/CustomMcpPanel.tsx` ↔ `widgets/custom_mcp_sheet.dart`
- `app/(main)/skills/page.tsx` ↔ `skills/ui/skills_screen.dart`

i18n parity: web `integrations.*` (41) + `skills.*` (17) identical across en/vi/zh/ja/ko/es/fr;
Flutter 36 connector/integration/skill ARB keys identical across all 7 locales. No hardcoded UI strings.

## Architecture as built

- New **connector-service (:3003)**: catalog, OAuth (Notion), AES-256-GCM token vault,
  MCP client (`@modelcontextprotocol/sdk`, ESM dynamic import), connections/custom-MCP CRUD,
  internal tools API guarded by `x-internal-key`.
- **ai-service**: `McpConnectorClient` (graceful-degrade — returns `[]`/`"connector unavailable"`
  if the connector is down) merged into the existing agent loop; dynamic tools namespaced
  `mcp__<provider>__<tool>`.
- **web + Flutter**: Integrations gallery (connect/manage/disconnect + custom MCP), Skills toggles.
- **infra**: Dockerfile + compose service + `pnpm connector` script; secrets in gitignored env files.

## NOT verified — needs secrets / deployment (HARD STOP)

The live end-to-end slice (plan E2 step 3 — connect Notion, message "create a Notion page",
observe the agent call `mcp__notion__create_page` and the page appear) **was not run** because it
requires:
1. **Notion OAuth app credentials** (`NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`) — not available.
2. A reachable Mongo for a live boot (local Docker Mongo is a replica set advertising `mongo:27017`,
   which doesn't resolve from the host — services normally run inside the compose network).
3. A real Notion account to authorize.

All code paths feeding that flow are unit-tested; the gap is integration with the real Notion MCP.

### To run the live E2E
1. Create a Notion integration (public OAuth) → fill `NOTION_CLIENT_ID/SECRET` in
   `apps/server/connector-service/.env` and `infra/docker-compose/.env`.
2. Set `JWT_ACCESS_SECRET` in `apps/server/connector-service/.env` (must match other services).
3. `docker compose -f infra/docker-compose/compose.yml up -d` (runs all services on the compose net).
4. Web `/integrations` → Connect Notion → authorize.
5. In chat: "Create a Notion page titled 'PON test'" → verify the page appears.

## Verify the local MCP catalog assumption

`NOTION_MCP_URL` defaults to `https://mcp.notion.com/sse`. If Notion's remote MCP contract/auth
differs from the OAuth-bearer assumption, the fallback (per spec §9) is to wrap the Notion REST API
behind the same `McpClientService` interface — no change to ai-service or the clients.
