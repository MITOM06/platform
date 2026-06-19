# P0 Part 2 — Cross-service Enforcement + Connector Governance

> TDD, one commit per task. Builds on Part 1 (capability catalog, JWT claims, roles).

**Goal:** Enforce RBAC where actions actually happen — secure connector-service with real JWT validation, gate connector actions by capability, split connectors into workspace vs personal with an allow-list, and filter the AI tool set by the member's permissions (sensitive-skill gate).

**Architecture:** A shared JWT auth layer (strategy + `@RequirePermission` guard) lives in `packages/database/src/auth/` so every NestJS service enforces identically. connector-service stops trusting the `userId` query param and derives identity from the verified JWT. Tool governance is applied inside connector-service (it shares the Mongo `platform` db, so it resolves a user's role→permissions directly) — ai-service needs no change.

## Global Constraints
- `JWT_ACCESS_SECRET` identical across services (already shared). Verify with the same secret/alg as auth-service.
- Capability checks import `Capability` from `@platform/database` — never re-declare.
- connector-service user-facing endpoints derive `userId` from `req.user.sub` (JWT), NOT from query/body. The internal API (`/internal/*`, `x-internal-key`) keeps taking `userId` (service-to-service, trusted).
- Backward-compat: tokens minted before Part 1 lack `perms` → treat missing `perms` as empty (deny capability-gated actions) but still allow identity (`sub`).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Keep all existing connector-service (20) + ai-service (97) tests green.

---

### Task 2.1: Shared JWT auth layer in `@platform/database`

**Files:**
- Create: `packages/database/src/auth/jwt-user.interface.ts`, `jwt.guard.ts`, `require-permission.guard.ts`, `current-user.decorator.ts`, `auth.index.ts`
- Modify: `packages/database/src/index.ts` (export the auth surface), `packages/database/package.json` (add `@nestjs/passport`, `passport`, `passport-jwt` if absent)
- Test: `packages/database/src/auth/require-permission.guard.spec.ts`

**Interfaces:**
- `interface JwtUser { sub: string; sid: string; role?: string; perms?: string[]; depts?: string[] }`
- `JwtAuthGuard` — passport-jwt guard verifying `JWT_ACCESS_SECRET` (Bearer), attaches `JwtUser` to `req.user`. (No Redis session check here — that's auth-service's concern; other services trust a validly-signed, unexpired token.)
- `@RequirePermission(cap: Capability)` + `RequirePermissionGuard` — 403 unless `req.user.perms` includes `cap`. Reuses the Part 1 decorator semantics but importable everywhere.
- `@CurrentUser()` param decorator → `req.user as JwtUser`.

- [ ] **Step 1:** Failing test — `RequirePermissionGuard` denies when `perms` missing/omits the cap, allows when present (mock `ExecutionContext`).
- [ ] **Step 2:** Run `pnpm --filter @platform/database test` → FAIL.
- [ ] **Step 3:** Implement the guards/decorator/interface; export. Add deps if missing; build.
- [ ] **Step 4:** Run → PASS; `pnpm --filter @platform/database build`.
- [ ] **Step 5:** Commit: `feat(database): shared JWT auth + RequirePermission for all services`.

---

### Task 2.2: connector-service — validate JWT, drop trusted userId

**Files:**
- Modify: `connections.controller.ts`, `oauth.controller.ts`, `catalog.controller.ts` (apply `JwtAuthGuard`; replace `@Query('userId')` with `@CurrentUser()` sub), `app.module.ts` (register guard/passport), `config` (ensure `JWT_ACCESS_SECRET` present)
- Test: update `connections.service.spec.ts` / add a controller guard test

**Interfaces:**
- All user-facing connector endpoints (`/catalog`, `/connections*`, `/oauth/:provider/start`, `/custom-mcp*`, `/skills*`) require a valid JWT; `userId` = `req.user.sub`. OAuth `:provider/callback` stays public (no JWT — it's a browser redirect; identity comes from the signed `state`).

- [ ] **Step 1:** Failing test — calling a connections endpoint without a JWT → 401; with a valid JWT, `userId` is taken from `sub` (not query).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Apply `JwtAuthGuard`; thread `sub` through services; remove `userId` query params from user-facing DTOs/handlers (keep on `/internal/*`).
- [ ] **Step 4:** Run connector tests → PASS; build.
- [ ] **Step 5:** Commit: `feat(connector): verify JWT + derive userId from token (drop trusted query param)`.

---

### Task 2.3: Workspace vs personal scope + capability gates

**Files:**
- Modify: `schemas/user-connection.schema.ts` (`scope: 'workspace'|'personal'`, default `'personal'`), `catalog.ts` (`tier: 'workspace'|'personal'|'both'` per entry; mark which connectors are workspace-shared), `oauth.service.ts` / `oauth.controller.ts` (gate start), `connections.controller.ts` (gate custom-mcp)
- Test: extend oauth + connections specs

**Interfaces:**
- Personal connect (`/oauth/:provider/start` for a personal-tier connector) requires `CONNECT_PERSONAL_CONNECTOR` AND the provider being in the workspace `connectorAllowList` (read the singleton Workspace doc).
- Workspace connect requires `CONNECT_WORKSPACE_CONNECTOR`; the resulting `UserConnection.scope='workspace'` and is usable by all members.
- `POST /custom-mcp` and `/custom-mcp/discover` require `ADD_CUSTOM_MCP`.
- `GET /connections` returns the caller's personal connections PLUS all workspace-scoped connections.

- [ ] **Step 1:** Failing test — start personal connect without `CONNECT_PERSONAL_CONNECTOR` → 403; with it but provider not in allow-list → 403; custom-mcp without `ADD_CUSTOM_MCP` → 403; workspace connections appear in every member's `GET /connections`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: read Workspace singleton for `connectorAllowList`; add `@RequirePermission` to the relevant routes; set `scope` on persist; merge workspace + personal in list.
- [ ] **Step 4:** Run → PASS; build.
- [ ] **Step 5:** Commit: `feat(connector): workspace/personal scope + capability + allow-list gates`.

---

### Task 2.4: Permission-aware tool exposure (sensitive-skill gate)

**Files:**
- Modify: `catalog.ts` / adapter tool defs (tag tools `sensitive: true` — e.g. send_email, external writes, create/update pages), `internal/internal.service.ts` (resolve the user's perms from Mongo and filter)
- Create: `internal/perm-resolver.service.ts` (+ spec) — `resolvePerms(userId): Promise<Set<Capability>>` via User→Role lookup in the shared db
- Test: `internal.service.spec.ts` update + `perm-resolver.service.spec.ts`

**Interfaces:**
- `PermResolverService.resolvePerms(userId)` loads `User.roleId` → `Role.permissions` → enabled capability set (uses `enabledCapabilities` from `@platform/database`). Caches per-call.
- `internal.getTools(userId)`: if the resolved perms lack `RUN_SENSITIVE_SKILL`, omit tools flagged `sensitive`. `internal.callTool(...)`: if the target tool is `sensitive` and perms lack `RUN_SENSITIVE_SKILL`, return `Tool error: not permitted` (defense in depth — never rely on the list filter alone).

- [ ] **Step 1:** Failing test — a user without `RUN_SENSITIVE_SKILL` gets a tool list excluding sensitive tools, and a direct `callTool` on a sensitive tool returns "not permitted"; a user with it gets/runs them.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `PermResolverService` + filtering in `getTools`/`callTool`; tag sensitive tools.
- [ ] **Step 4:** Run connector tests (all) → PASS; build. Confirm ai-service tests still pass untouched (`pnpm --filter ai-service test`).
- [ ] **Step 5:** Commit: `feat(connector): permission-aware tool exposure (sensitive-skill gate)`.

---

### Task 2.5: QA Part 2

- [ ] **Step 1:** Run `pnpm --filter @platform/database test && pnpm --filter connector-service test && pnpm --filter ai-service test` — all green; builds exit 0.
- [ ] **Step 2:** Append a Part 2 section to `_workspace/06_p0_part1_report.md` (or new `07_p0_part2_report.md`): what's enforced where, the sensitive-tool list, and that chat-service (Java) enforcement is deferred to P6.
- [ ] **Step 3:** Commit: `test(connector): P0 Part 2 enforcement QA`.

## Self-Review
- Reframe §6 (governance) → 2.2/2.3/2.4; §3 caps → enforced via shared guard (2.1). Security gap (trusted userId) closed (2.2). ai-service untouched (governance pushed into connector-service). chat-service Java enforcement explicitly deferred to P6.
