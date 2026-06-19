# P0 Part 2 — Cross-service Enforcement + Connector Governance — QA Report

Branch: `feature/mcp-connector-core`. Builds on Part 1 (capability catalog, JWT
claims, preset roles). Touched ONLY `packages/database/` and
`apps/server/connector-service/`. auth-service, ai-service, chat-service, web,
and Flutter were not modified (ai-service tests were run to prove they stay green).

## What is enforced, and where

### Shared JWT auth layer — `@platform/database` (Task 2.1)
- `packages/database/src/auth/` now exports a reusable enforcement surface, so
  every NestJS service (except auth-service, which owns session state) enforces
  identically:
  - `SharedJwtStrategy` / `JwtAuthGuard` — passport-jwt, verifies `JWT_ACCESS_SECRET`
    as a Bearer token, HS256 (same as auth-service's `@nestjs/jwt` default
    signing). Attaches `JwtUser` to `req.user`. **No Redis session-revocation
    check** — that is auth-service's job; downstream services trust a validly-
    signed, unexpired token.
  - `@RequirePermission(cap)` + `RequirePermissionGuard` — 403 unless
    `req.user.perms` includes the capability. Missing `perms` (pre-enterprise
    token) ⇒ denied for capability-gated routes, identity (`sub`) still honored.
  - `@CurrentUser()` param decorator → `req.user as JwtUser`.
  - `JwtUser` interface: `{ sub, sid, role?, perms?, depts?, iat?, exp? }`.

### connector-service identity (Task 2.2) — the security fix
- The vulnerability — user-facing endpoints trusting a `userId` query param — is
  closed. `connections.controller` and the `/oauth/:provider/start` route now run
  behind `JwtAuthGuard` and derive `userId` strictly from `req.user.sub`.
- `userId` was removed from user-facing DTOs (`SetSkillDto`).
- `GET/DELETE /connections`, `GET/PUT /skills`, `POST /custom-mcp*`,
  `GET /oauth/:provider/start` → **JWT required**.
- `GET /oauth/:provider/callback` stays **PUBLIC** (browser redirect; identity is
  carried in the HMAC-signed `state`).
- `/internal/*` keeps taking `userId` and stays guarded by `x-internal-key`
  (trusted service-to-service path; ai-service unchanged).
- `deleteConnection` is now scoped to the caller (`userId` + `scope != workspace`)
  so a member cannot delete another member's (or a shared workspace) connection.

### Workspace vs personal scope + gates (Task 2.3)
- `UserConnection.scope: 'personal' | 'workspace'` (default `'personal'`, indexed).
- Catalog entries carry a governance `tier: 'workspace' | 'personal' | 'both'`
  (exposed in the public catalog view). Notion = `both`; gmail/calendar/drive
  placeholders = `personal`.
- `POST /custom-mcp` and `/custom-mcp/discover` require `ADD_CUSTOM_MCP`.
- Personal connect (`/oauth/:provider/start` for a personal/both-tier connector)
  requires `CONNECT_PERSONAL_CONNECTOR` **AND** the provider being in the
  singleton Workspace's `connectorAllowList`.
- Workspace connect (workspace-tier) requires `CONNECT_WORKSPACE_CONNECTOR`; the
  resulting connection is persisted with `scope='workspace'`.
- `GET /connections` returns the caller's personal connections **PLUS** all
  workspace-scoped connections (`$or: [{userId}, {scope:'workspace'}]`).

### Permission-aware tool exposure (Task 2.4)
- New `PermResolverService.resolvePerms(userId): Promise<Set<Capability>>` reads
  `User.roleId` → `Role.permissions` → `enabledCapabilities(matrix)` from the
  shared `platform` Mongo db. Fails closed (empty set on no role / no user / error).
- `internal.getTools(userId)`: resolves perms once; if the user lacks
  `RUN_SENSITIVE_SKILL`, `sensitive`-tagged tools are omitted from the list (built-in
  AND custom MCP tools). Also now includes workspace-scoped active connections.
- `internal.callTool(...)`: defense-in-depth re-check — a `sensitive` tool with no
  `RUN_SENSITIVE_SKILL` returns `Tool error: not permitted (sensitive skill)`
  without ever dispatching to the MCP server.
- ai-service needs **no change** — governance is pushed entirely into
  connector-service, which already shares the database.

## Sensitive-tagged tools (final list)
Matched on the bare `<tool>` name (case-insensitive) of `mcp__<provider>__<tool>`,
defined in `catalog.ts` `SENSITIVE_TOOLS`:

- `send_email`
- `send_message`
- `create_page`
- `update_page`
- `create_database`
- `update_database`
- `create-pages`
- `update-page`
- `create_event`
- `update_event`
- `delete_event`
- `create_file`
- `update_file`
- `delete_file`

(Email sends, Notion page/database creates+updates, calendar event writes, and
Drive file writes — i.e. send_email, external writes, and page create/update.)

## chat-service (Java) enforcement — DEFERRED to P6
chat-service is Spring Boot 3 and does not consume the NestJS shared guard. Its
RBAC enforcement (the Java equivalent of `JwtAuthGuard` + `@RequirePermission`)
is explicitly deferred to **P6** per the plan's self-review. No chat-service code
was touched in Part 2.

## Final test/build output
```
@platform/database  test:  Test Suites: 2 passed, 2 total | Tests: 10 passed, 10 total
@platform/database  build: exit 0
connector-service   test:  Test Suites: 9 passed, 9 total | Tests: 37 passed, 37 total
connector-service   build: exit 0
ai-service          test:  Test Suites: 12 passed, 12 total | Tests: 97 passed, 97 total
```
- connector-service kept all 20 original tests and added 17 (controller guard,
  oauth gating, list-merge, perm-resolver, sensitive-tool filtering) = 37.
- ai-service stayed at its 97 tests, untouched.
- @platform/database went 5 → 10 (added the RequirePermissionGuard spec).

## Commits (one per task, trailer included)
- Task 2.1 — `feat(database): shared JWT auth + RequirePermission for all services`
- Task 2.2 — `feat(connector): verify JWT + derive userId from token (drop trusted query param)`
- Task 2.3 — `feat(connector): workspace/personal scope + capability + allow-list gates`
- Task 2.4 — `feat(connector): permission-aware tool exposure (sensitive-skill gate)`
- Task 2.5 — `test(connector): P0 Part 2 enforcement QA`

## Deviations
- **connector-service had no `@platform/database` dependency.** To wire the shared
  auth layer it now declares `@platform/database: workspace:*` plus
  `@nestjs/passport`, `passport`, `passport-jwt` (+ `@types/passport-jwt`), and
  tsconfig `paths` + a jest `moduleNameMapper` to the package source — mirroring
  exactly how auth-service consumes the package. Necessary, in-scope.
- **Task 2.2 deliberately split from 2.3:** `start` first derived `user.sub` only
  (2.2), then was widened to take the full `JwtUser` for tier/allow-list gating
  (2.3). Final signature is `startAuthorization(provider, user: JwtUser)`.
- **`getTools` connection query widened** to include `scope:'workspace'`
  connections (Task 2.3 governance: workspace connectors usable by all members),
  in addition to the sensitive-tool filter (2.4).
