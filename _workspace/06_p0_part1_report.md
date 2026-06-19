# P0 Enterprise Foundation — PART 1 Report (Identity & RBAC backbone)

**Branch:** `feature/mcp-connector-core`
**Scope:** `packages/database/` + `apps/server/auth-service/` only. Nothing else touched.
**Method:** TDD, one commit per task (Tasks 1.1–1.6), each with the plan's commit message + trailer
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Commits (oldest → newest)

| # | Hash | Message |
|---|------|---------|
| 1.1 | `999381df` | feat(database): RBAC capability catalog + preset roles |
| 1.2 | `577aad00` | feat(database): workspace/department/role schemas + user membership fields |
| 1.3 | `42c3f5f5` | feat(auth): bootstrap workspace + preset roles + first owner |
| 1.4 | `f43cad91` | feat(auth): embed role/permissions/departments in access token |
| 1.5 | `d16aef67` | feat(auth): admin API for departments/members/roles + permission guard |
| 1.6 | `33254bdc` | feat(auth): /me/capabilities for client UI gating |

---

## Final verification output (all pass)

```
# packages/database
$ pnpm --filter @platform/database build   → tsc OK (no errors)
$ pnpm --filter @platform/database test
  PASS src/rbac/preset-roles.spec.ts
  Test Suites: 1 passed, 1 total
  Tests:       5 passed, 5 total

# apps/server/auth-service
$ pnpm --filter @platform/auth-service test
  PASS src/modules/admin/admin.service.spec.ts
  PASS src/modules/auth/auth.controller.spec.ts
  PASS src/modules/workspace/me.controller.spec.ts
  PASS src/modules/auth/sign-access-token.spec.ts
  PASS src/modules/friends/friends.service.spec.ts
  PASS src/modules/workspace/bootstrap.service.spec.ts
  PASS src/app.controller.spec.ts
  PASS src/modules/auth/claims.service.spec.ts
  PASS src/modules/auth/guards/require-permission.guard.spec.ts
  Test Suites: 9 passed, 9 total
  Tests:       32 passed, 32 total
$ pnpm --filter @platform/auth-service build   → nest build / webpack compiled successfully
```

**Test counts:** database 5; auth-service 32 (incl. all 3 pre-existing suites — app.controller, auth.controller, friends.service — still green). Total **37**.

---

## Files created

### packages/database
- `src/rbac/capabilities.ts` — `Capability` string enum (11 keys), `PermissionMatrix` type, `ALL_CAPABILITIES`, `buildFullMatrix()`, `enabledCapabilities()`. Single source of truth.
- `src/rbac/preset-roles.ts` — `PRESET_ROLES` (Owner/Admin/Manager/Member) + `PresetRole`/`PresetRoleName` types, matching reframe §3.
- `src/rbac/preset-roles.spec.ts` — 5 tests.
- `src/mongo/workspace.schema.ts` — singleton `Workspace` (name, logoUrl?, primaryColor?, features, connectorAllowList).
- `src/mongo/department.schema.ts` — `Department` (name indexed, description?, leadUserId?).
- `src/mongo/role.schema.ts` — `Role` (unique name, isPreset, permissions: Mixed).

### apps/server/auth-service
- `src/modules/workspace/bootstrap.service.ts` — `OnApplicationBootstrap`, idempotent seed of workspace + 4 roles + first Owner.
- `src/modules/workspace/workspace.module.ts` — registers schemas, BootstrapService, WorkspaceService, ClaimsService, MeController.
- `src/modules/workspace/workspace.service.ts` — `getPublicConfig()` (name/features/connectorAllowList).
- `src/modules/workspace/me.controller.ts` — `GET /me/capabilities`.
- `src/modules/workspace/bootstrap.service.spec.ts` — 4 tests.
- `src/modules/workspace/me.controller.spec.ts` — 1 test.
- `src/modules/auth/claims.service.ts` — `resolve(userId)` → `{ role, perms, depts }`, Member fallback.
- `src/modules/auth/claims.service.spec.ts` — 4 tests.
- `src/modules/auth/sign-access-token.spec.ts` — 2 tests (claims embedded + back-compat).
- `src/modules/auth/guards/require-permission.guard.ts` — `RequirePermissionGuard` + `@RequirePermission()` + `PERMISSION_KEY`.
- `src/modules/auth/guards/require-permission.guard.spec.ts` — 5 tests.
- `src/modules/admin/admin.service.ts` — departments/members/roles/workspace ops.
- `src/modules/admin/admin.controller.ts` — `/admin/*` routes behind JwtAuthGuard + capability gates.
- `src/modules/admin/admin.module.ts` — wires it all + SessionService.
- `src/modules/admin/admin.service.spec.ts` — 7 tests.
- `src/modules/admin/dto/department.dto.ts`, `member.dto.ts`, `role.dto.ts`, `workspace.dto.ts` — class-validator DTOs.

## Files modified

### packages/database
- `src/index.ts` — export rbac + workspace/department/role schemas (rbac exported before role.schema to avoid init-order issues).
- `src/mongo/user.schema.ts` — added `roleId?: ObjectId` and `departmentIds: ObjectId[]` (default `[]`).
- `package.json` — added `test` script + jest config (ts-jest, node env).
- `tsconfig.json` — exclude `**/*.spec.ts` from build output.

### apps/server/auth-service
- `src/app.module.ts` — import `WorkspaceModule` + `AdminModule`.
- `src/config/app.config.ts` — `workspaceName`, `bootstrapOwnerEmail`.
- `.env.example` — `WORKSPACE_NAME`, `BOOTSTRAP_OWNER_EMAIL`.
- `src/modules/auth/auth.service.ts` — `signAccessToken` extended with optional role/perms/depts; new private `signAccessTokenWithClaims`; injected `ClaimsService`; 3 call sites (login, exchangeLoginCode, refresh) now embed claims.
- `src/modules/auth/strategies/jwt.strategy.ts` — `JwtPayload` gains optional `role`/`perms`/`depts`.
- `src/modules/auth/auth.module.ts` — registers `ClaimsService` + User/Role models.

---

## API endpoints implemented

| Method/Path | Capability | Status |
|---|---|---|
| `GET /admin/departments` | MANAGE_DEPARTMENTS | ✓ |
| `POST /admin/departments` | MANAGE_DEPARTMENTS | ✓ |
| `PATCH /admin/departments/:id` | MANAGE_DEPARTMENTS | ✓ |
| `DELETE /admin/departments/:id` | MANAGE_DEPARTMENTS | ✓ |
| `GET /admin/members` | MANAGE_MEMBERS | ✓ |
| `PATCH /admin/members/:id` | MANAGE_MEMBERS | ✓ (revokes sessions) |
| `GET /admin/roles` | MANAGE_ROLES | ✓ |
| `POST /admin/roles` | MANAGE_ROLES | ✓ |
| `PATCH /admin/roles/:id` | MANAGE_ROLES | ✓ (Owner immutable) |
| `GET /admin/workspace` | MANAGE_WORKSPACE | ✓ |
| `PATCH /admin/workspace` | MANAGE_WORKSPACE | ✓ (upsert singleton) |
| `GET /me/capabilities` | (JWT only) | ✓ |

---

## Key design decisions

- **Single-workspace honored:** Workspace is a singleton (count-gated create / upsert with `{}` filter); membership embedded on `User` (`roleId`, `departmentIds`); no cross-company `orgId` anywhere.
- **Capability catalog lives once** in `packages/database` and is imported by auth-service (DTOs, guard, claims, bootstrap). Never duplicated.
- **Owner** built from `buildFullMatrix(true)` so new capabilities auto-grant to Owner; Owner role is immutable in `updateRole`.
- **Stale-permission safety:** `updateMember` calls `session.revokeAllSessions(userId)` after role/dept change — stale perms can't outlive one access-token lifetime.
- **Backward compat:** JWT `role`/`perms`/`depts` are optional; `signAccessToken` only embeds them when present; in-flight minimal tokens keep working. `JWT_ACCESS_SECRET` unchanged.
- **`Manager` "own-dept" cells** (manage members / view audit for own dept, per §3) are NOT modeled as coarse boolean capabilities — Manager does not hold workspace-wide `MANAGE_MEMBERS`/`VIEW_AUDIT_LOG`. Department-scoped authorization is left to the service layer (Part 2). This is the one place the §3 matrix maps to "false" at the capability level by design.

---

## Deviations from the plan (with reasons)

1. **`@platform/database` had no test runner.** Added a jest config + `test` script (ts-jest, matching auth-service). Required to satisfy `pnpm --filter @platform/database test`.
2. **Removed stale compiled artifacts (`*.js`/`*.d.ts`/`*.js.map`) from `packages/database/src/`.** They were leftover build output committed into `src/` and, because jest's `moduleFileExtensions` resolves `.js` before `.ts`, the stale `src/index.js` shadowed the real `.ts` sources — the new exports were invisible to auth-service's jest. Deleting them + excluding specs from the build (`tsconfig.json`) fixed it. Bundled into the Task 1.3 commit since that's where the failure surfaced.
3. **`GET /me/capabilities` placed in a dedicated `MeController`** (workspace module) rather than the existing users controller. The users controller has a bare `@Get(':id')` route that would swallow `/me/capabilities`; a separate controller (path `me`) avoids the ordering collision and keeps it clean. The plan allowed users-or-auth controller; this is functionally equivalent and safer.
4. **`signAccessTokenWithClaims` helper added** (private, async) so the 3 call sites resolve + embed claims uniformly without duplicating logic. `signAccessToken` itself stays synchronous and back-compatible.

No backward-compatibility breaks. No API contract changes to existing endpoints.

---

## What Part 2+ will need

- **Extract `@RequirePermission` + the guard for cross-service reuse.** It currently lives in auth-service. Part 2 wants chat/ai/connector to enforce caps from the JWT. Options: move guard to `packages/database` (already a shared dep) or a new `packages/auth-shared`. The `Capability` enum is already shared — only the Nest guard/decorator need relocating. The guard reads `req.user.perms`; each service must run a JWT strategy that puts the decoded payload on `req.user` (auth-service's strategy returns the full payload incl. perms — mirror that shape).
- **JWT now carries `role`/`perms`/`depts`** — other services can read them straight off the verified token (stateless). No call back to auth-service needed for enforcement. `JWT_ACCESS_SECRET` is identical across services (unchanged).
- **connector-service retrofit:** add `scope: 'workspace'|'personal'` to `UserConnection`; gate `POST /custom-mcp*` on `ADD_CUSTOM_MCP`; gate personal connect on `CONNECT_PERSONAL_CONNECTOR` + workspace `connectorAllowList` (already exposed via `GET /me/capabilities` and `GET /admin/workspace`).
- **Department-scoped authorization** (Manager managing own dept, audit own dept) is intentionally NOT in the coarse capability matrix — Part 2/5 must implement dept-scoping in service logic using the `depts` claim.
- **Bootstrap requires Mongo auto-index-creation** for the new `Role.name` unique index + `Department.name` index to build in prod (per prior infra note on `auto-index-creation`). Verify on deploy.
- **No HTTP/e2e tests** for `/admin/*` and `/me/*` yet — only unit tests on services/guards/controllers. Part 1 QA could add supertest e2e against the real guard chain (out of Part 1 plan scope).
- **Admin console (Part 3 web) + Flutter mirror (Part 4)** consume `GET /me/capabilities` for UI gating and the `/admin/*` API for management screens. i18n keys for all 7 locales will be needed there.
