# P0 — Enterprise Foundation Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. Steps use `- [ ]`. Delivered in PARTS; owner reviews after each part before the next starts.

**Goal:** Give the existing single deployment a flexible enterprise backbone — one Workspace (the company), Departments, Members, and hybrid RBAC (preset roles + admin-customizable permission matrix) — enforced across all services via JWT claims, with an admin console. Ready-made for any company; no per-company code forks.

**Architecture:** Identity lives in auth-service (`auth-guard.md` grants full access). Shared schemas + the canonical capability list live in `packages/database` so every service and client agrees. JWT access tokens carry `role`, `perms`, `depts`; services enforce statelessly. Single-workspace-per-deployment ⇒ membership is embedded on `User` (no Membership collection, no cross-org `orgId`).

**Tech Stack:** NestJS, Mongoose (`packages/database`), `@nestjs/jwt` (existing), Next.js admin UI, Flutter mirror.

## Global Constraints

- One Workspace per deployment (singleton config doc). No cross-company `orgId` on records.
- `JWT_ACCESS_SECRET` identical across services (unchanged). Access token stays ~15m.
- Capability list is defined ONCE in `packages/database` and imported everywhere — never duplicated.
- On role/department change → revoke the affected user's sessions (force token re-issue) so stale perms can't linger past one access-token lifetime.
- Preset roles seeded idempotently on bootstrap; the Owner role is undeletable and always has all capabilities.
- Max file length: backend 500, web/Flutter 400. Commit per task; trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Do not break existing auth-service tests.

---

## PART 1 — Identity & RBAC backbone (auth-service + packages/database)  ← BUILD FIRST

### Task 1.1: Capability catalog + preset role matrix (shared)

**Files:**
- Create: `packages/database/src/rbac/capabilities.ts`, `packages/database/src/rbac/preset-roles.ts`
- Modify: `packages/database/src/index.ts` (export them)
- Test: `packages/database/src/rbac/preset-roles.spec.ts`

**Interfaces:**
- Produces: `enum Capability` (string enum) with keys: `MANAGE_WORKSPACE`, `MANAGE_DEPARTMENTS`, `MANAGE_MEMBERS`, `MANAGE_ROLES`, `CONNECT_WORKSPACE_CONNECTOR`, `ADD_CUSTOM_MCP`, `CONNECT_PERSONAL_CONNECTOR`, `USE_PERSONAL_ASSISTANT`, `USE_GROUP_BOT`, `RUN_SENSITIVE_SKILL`, `VIEW_AUDIT_LOG`.
- `type PermissionMatrix = Partial<Record<Capability, boolean>>`.
- `PRESET_ROLES: Array<{ name:'Owner'|'Admin'|'Manager'|'Member'; isPreset:true; permissions: PermissionMatrix }>` exactly per the reframe spec §3 table.

- [ ] **Step 1:** Failing test — `PRESET_ROLES` has 4 entries; `Owner` has every `Capability` set true; `Member` has `ADD_CUSTOM_MCP=false` and `USE_PERSONAL_ASSISTANT=true`.
- [ ] **Step 2:** Run `pnpm --filter @platform/database test` → FAIL.
- [ ] **Step 3:** Implement the enum + matrix + presets.
- [ ] **Step 4:** Run → PASS; `pnpm --filter @platform/database build`.
- [ ] **Step 5:** Commit: `feat(database): RBAC capability catalog + preset roles`.

### Task 1.2: Workspace, Department, Role schemas + User fields

**Files:**
- Create: `packages/database/src/mongo/workspace.schema.ts`, `department.schema.ts`, `role.schema.ts`
- Modify: `packages/database/src/mongo/user.schema.ts` (add `roleId?`, `departmentIds[]`), `packages/database/src/index.ts`

**Interfaces:**
- `Workspace` (singleton): `name, logoUrl?, primaryColor?, features: Record<string,boolean>, connectorAllowList: string[]` (catalog ids members may personally connect), timestamps.
- `Department`: `name, description?, leadUserId?`, timestamps, index on `name`.
- `Role`: `name, isPreset:boolean, permissions: PermissionMatrix` (Mixed), unique `name`.
- `User` gains `@Prop() roleId?: ObjectId` and `@Prop({type:[ObjectId],default:[]}) departmentIds: ObjectId[]`.

- [ ] **Step 1:** Write the three schemas + the two User props (default `departmentIds: []`); export all.
- [ ] **Step 2:** `pnpm --filter @platform/database build` → compiles.
- [ ] **Step 3:** Commit: `feat(database): workspace/department/role schemas + user membership fields`.

### Task 1.3: Bootstrap service (seed workspace + roles + first Owner)

**Files:**
- Create: `apps/server/auth-service/src/modules/workspace/bootstrap.service.ts`, `workspace.module.ts`
- Test: `bootstrap.service.spec.ts`
- Modify: auth-service `app.module.ts` (import WorkspaceModule), config (`BOOTSTRAP_OWNER_EMAIL`)

**Interfaces:**
- `BootstrapService` `OnApplicationBootstrap`: idempotently (1) upsert the singleton `Workspace` (name from `WORKSPACE_NAME` env, default "PON Workspace"); (2) upsert the 4 preset `Role`s from `PRESET_ROLES`; (3) if `BOOTSTRAP_OWNER_EMAIL` matches an existing user with no role, assign the Owner role.

- [ ] **Step 1:** Failing test — running bootstrap twice yields exactly 1 workspace + 4 roles (idempotent); a user matching `BOOTSTRAP_OWNER_EMAIL` gets the Owner roleId.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement idempotent upserts (match presets by `name`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(auth): bootstrap workspace + preset roles + first owner`.

### Task 1.4: Embed RBAC claims in the JWT

**Files:**
- Modify: `apps/server/auth-service/src/modules/auth/auth.service.ts` (`signAccessToken` + call sites), `strategies/jwt.strategy.ts` (`JwtPayload`)
- Create: `apps/server/auth-service/src/modules/auth/claims.service.ts` (+ spec)

**Interfaces:**
- `ClaimsService.resolve(userId): Promise<{ role:string; perms: Capability[]; depts: string[] }>` — loads the user's role + permissions (enabled capability keys) + departmentIds (as strings). Falls back to `{role:'Member', perms:[], depts:[]}` if unassigned.
- `signAccessToken(payload: { sub; sid; role; perms; depts })` — extend the signed payload. `JwtPayload` gains `role`, `perms: string[]`, `depts: string[]` (all optional for backward-compat with in-flight tokens).

- [ ] **Step 1:** Failing test — `signAccessToken` includes `role`/`perms`/`depts`; `ClaimsService.resolve` maps a role's `permissions` matrix to the enabled-capability array.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `ClaimsService`; at each `signAccessToken` call site, resolve claims and pass them in. Keep payload small (perms = enabled keys only).
- [ ] **Step 4:** Run auth tests → PASS (existing green).
- [ ] **Step 5:** Commit: `feat(auth): embed role/permissions/departments in access token`.

### Task 1.5: Admin API — departments, members, roles

**Files:**
- Create: `apps/server/auth-service/src/modules/admin/admin.controller.ts`, `admin.service.ts`, `dto/*.ts`, `admin.module.ts`
- Create: `apps/server/auth-service/src/modules/auth/guards/require-permission.guard.ts` + `@RequirePermission()` decorator
- Test: `admin.service.spec.ts`, `require-permission.guard.spec.ts`

**Interfaces:**
- `@RequirePermission(cap: Capability)` guard reads `req.user.perms` (from JWT) and 403s if missing.
- Endpoints (all behind JwtAuthGuard + RequirePermission):
  - Departments: `GET/POST /admin/departments`, `PATCH/DELETE /admin/departments/:id` (MANAGE_DEPARTMENTS)
  - Members: `GET /admin/members`, `PATCH /admin/members/:id` (set roleId + departmentIds → also revoke that user's sessions) (MANAGE_MEMBERS)
  - Roles: `GET/POST /admin/roles`, `PATCH /admin/roles/:id` (clone/edit permissions; cannot edit/delete Owner) (MANAGE_ROLES)
  - `GET /admin/workspace`, `PATCH /admin/workspace` (name/branding/features/connectorAllowList) (MANAGE_WORKSPACE)

- [ ] **Step 1:** Failing test — `RequirePermission` 403s without the cap, allows with it; `admin.service.updateMember` sets role/depts AND calls `session.revokeAllSessions(userId)`; editing the Owner role throws.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement guard + service + controller + DTOs (class-validator).
- [ ] **Step 4:** Run → PASS; build.
- [ ] **Step 5:** Commit: `feat(auth): admin API for departments/members/roles + permission guard`.

### Task 1.6: `GET /auth/me` capabilities + QA Part 1

**Files:** Modify auth `users`/`auth` controller to expose `GET /me/capabilities` → `{role, perms, depts, workspace:{name,features,connectorAllowList}}` (for clients to gate UI). Spec it.

- [ ] **Step 1:** Failing test — endpoint returns the caller's resolved caps + workspace public config.
- [ ] **Step 2:** Implement → PASS.
- [ ] **Step 3:** Run full auth-service test suite + build. Commit: `feat(auth): /me/capabilities for client UI gating`.
- [ ] **Step 4:** Write `_workspace/06_p0_part1_report.md` (what shipped, test counts, what Part 2+ needs).

**→ CHECKPOINT: owner reviews Part 1 before Part 2.**

---

## PART 2 — Cross-service enforcement + connector governance retrofit (outline)
- Shared `@RequirePermission` made importable by chat/ai/connector (extract to `packages/database` or a small `packages/auth-shared`); each service validates JWT + reads `perms`.
- connector-service: add `scope:'workspace'|'personal'` to `UserConnection`; gate `POST /custom-mcp*` behind `ADD_CUSTOM_MCP`; gate personal connect behind `CONNECT_PERSONAL_CONNECTOR` + workspace `connectorAllowList`; workspace connectors visible to all members.
- ai-service: only load tools the member's role permits; `RUN_SENSITIVE_SKILL` gate on send-mail/external-write tools.
- **Checkpoint review.**

## PART 3 — Admin console (web, Next.js) (outline)
- `app/(main)/admin/` route group, gated by caps from `/me/capabilities`.
- Screens: Workspace settings, Departments, Members (assign role/department), Roles & permissions matrix editor, Connector allow-list, Audit log.
- i18n all 7 locales. **Checkpoint review.**

## PART 4 — Flutter admin mirror + capability UI gating (outline)
- Capability provider from `/me/capabilities`; hide/disable actions the role lacks (sync rule).
- Admin screens mirror web. ARB ×7. **Checkpoint review.**

## PART 5 — Audit log (outline)
- `AuditLog` schema + `AuditService.record(actor, action, target, meta)`; write points at privileged mutations (member/role/connector/workspace changes, sensitive skill runs); `GET /admin/audit` (VIEW_AUDIT_LOG) + UI. **Checkpoint review.**

## Self-Review
- Reframe §2 (structure) → 1.2; §3 (RBAC matrix) → 1.1/1.5; §4 (JWT claims) → 1.4; §6 (governance) → Part 2; §7 (audit) → Part 5; §9 (P0 contents) → Parts 1–5.
- Single-workspace assumption honored: membership embedded on User, Workspace is singleton, no cross-org orgId.
- Stale-permission risk handled by revoke-sessions-on-change (Global Constraints + Task 1.5).
