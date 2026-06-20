# PON Enterprise — Master Handoff & Continuation Guide

**Last updated:** 2026-06-20
**Active branch:** `feature/mcp-connector-core` (✅ P0 COMPLETE — Parts 1–5 + Task 0; ✅ P5 Google connectors)
**Read order for a fresh session:**
1. This file (state + remaining work).
2. `docs/superpowers/specs/2026-06-19-pon-enterprise-reframe.md` (the vision).
3. The relevant plan in `docs/superpowers/plans/` for the part you're building.

---

## 1. Product direction (locked)

PON is a **self-hosted, single-tenant-per-deployment B2B enterprise AI-assistant platform**.
One deployment = one company (a singleton **Workspace**). Companies are isolated at the
**infrastructure level** (separate deployments) — NOT multi-tenant SaaS, so there is **no
cross-company `orgId`** on records. Inside one deployment: **Workspace → Departments → Members →
Role**. RBAC is **hybrid** (preset role templates + admin-customizable permission matrix stored as
data). Connectors are **governed** (workspace + personal w/ allow-list; custom MCP = admin-only).
Each user has a **personal AI assistant**; departments get a **group bot** (data-scoped by role).

For now: keep hosting as-is, assume **one test company**, get it working end-to-end, then scale.

---

## 2. What is DONE (on `feature/mcp-connector-core`)

### Specs & plans (all committed)
- `docs/superpowers/specs/2026-06-19-pon-mcp-connector-core-design.md` — P1 connector core.
- `docs/superpowers/specs/2026-06-19-pon-enterprise-reframe.md` — enterprise vision + revised roadmap.
- `docs/superpowers/plans/2026-06-19-mcp-connector-core.md` — P1 plan (DONE).
- `docs/superpowers/plans/2026-06-19-p5-google-connectors.md` — P5 plan (NOT built).
- `docs/superpowers/plans/2026-06-19-p0-enterprise-foundation.md` — P0 plan (Part 1 detailed; Parts 3–5 outlined).
- `docs/superpowers/plans/2026-06-19-p0-part2-enforcement.md` — P0 Part 2 plan (DONE).

### P1 — MCP Connector Core ✅ (built, tested)
- **`apps/server/connector-service/`** (NestJS, :3003): catalog, OAuth (Notion), AES-256-GCM token
  vault, MCP client (`@modelcontextprotocol/sdk`), connections + custom-MCP CRUD, internal tools API.
- **ai-service**: `apps/server/ai-service/src/tools/mcp-connector.client.ts` + registry/loop wiring —
  per-user dynamic tools `mcp__<provider>__<tool>` merged into the agent loop (graceful-degrade).
- **web**: `apps/web/app/(main)/integrations/page.tsx`, `app/(main)/skills/page.tsx`,
  `components/integrations/*`, `lib/api/connector*.ts`, `lib/hooks/use-connectors.ts`, `lib/skills.ts`.
- **Flutter**: `apps/client/lib/features/integrations/*`, `lib/features/skills/*`,
  `connectorDio` in `lib/core/api/dio_client.dart`.
- **infra**: `apps/server/connector-service/Dockerfile`, compose service, `pnpm connector` script.
- Tests at completion: connector 20, ai-service 97, web build OK, flutter analyze clean.

### P0 Part 1 — Identity & RBAC backbone ✅
- **`packages/database/src/rbac/`**: `capabilities.ts` (11-capability `Capability` enum + helpers),
  `preset-roles.ts` (`PRESET_ROLES`: Owner/Admin/Manager/Member matrix).
- **`packages/database/src/mongo/`**: `workspace.schema.ts` (singleton config incl.
  `connectorAllowList`), `department.schema.ts`, `role.schema.ts`; `user.schema.ts` gained
  `roleId` + `departmentIds`.
- **auth-service**: `src/modules/workspace/bootstrap.service.ts` (seed workspace + roles + first
  Owner), `src/modules/auth/claims.service.ts` (resolve `{role,perms,depts}`), JWT now carries
  `role`/`perms`/`depts`, `src/modules/admin/*` (departments/members/roles/workspace API),
  `guards/require-permission.guard.ts`, `MeController` `GET /me/capabilities`.
- Tests: `@platform/database` 5, auth-service 32.

### P0 Part 2 — Enforcement + connector governance ✅
- **`packages/database/src/auth/`**: shared `JwtAuthGuard`, `@RequirePermission`, `@CurrentUser`,
  `JwtUser` — importable by every NestJS service.
- **connector-service**: validates JWT (derives userId from `sub`, no more trusted query param),
  `scope:'workspace'|'personal'` on connections, capability + allow-list gates on connect/custom-MCP,
  `internal/perm-resolver.service.ts` resolves role→perms from Mongo, sensitive tools filtered +
  blocked at execution unless `RUN_SENSITIVE_SKILL`.
- Tests: `@platform/database` 10, connector 37, ai-service 97 (unchanged).

### Task 0 — Client connector-contract cleanup ✅
- web (`lib/api/connector.ts`, `lib/hooks/use-connectors.ts`, integrations page) + Flutter
  (`connector_repository.dart`, integrations/skills providers) no longer send the dead `userId`
  param — identity comes from the JWT. Guards kept as fail-fast auth checks.
- Verify: web build OK; `flutter analyze` clean. Commit `24e40581`.

### P0 Part 3 — Admin console (web) ✅
- **`apps/web/lib/api/admin{,-types}.ts`**: typed client over the reused `authApi` instance
  (auth-service hosts `/admin/*` + `/me/capabilities`); `CAPABILITIES` union mirrors
  `@platform/database` (no server schema in the bundle).
- **hooks**: `use-capabilities.ts` (`useCapabilities`/`useHasCapability`/`useCanAccessAdmin`),
  `use-admin.ts` (query+mutation hooks per resource).
- **`components/admin/`**: `RequireCap`, `AdminShell` (cap-filtered section nav), `WorkspaceSettings`,
  `DepartmentsPanel`, `MembersPanel`, `RolesPanel` (Capability×role matrix, Owner read-only, clone),
  `AuditLogPanel` (placeholder).
- **`app/(main)/admin/`**: layout + index redirect + 5 RequireCap-wrapped pages. Nav "Admin" entry
  (gated) in `(main)/layout.tsx`; `/admin` hides the chat aside. i18n `admin.*` + `layout.menuAdmin`
  across all 7 locales. Verify: web build OK, 6 `/admin` routes. Commit `1039f190`.

### P0 Part 4 — Flutter admin mirror ✅ (web↔mobile sync)
- **`apps/client/lib/features/admin/`**: `data/` (admin_models.dart `Cap`/MeCapabilities/Workspace/
  Department/Member/Role + `AdminRepository` on authDio), `state/` (capabilitiesProvider +
  hasCapability/canAccessAdmin family + AsyncNotifiers per resource), `ui/` (AdminScreen shell with
  cap-filtered tabs + home redirect; workspace/departments/members/roles/audit panels; cap_label).
- router `/admin`; settings capability-gated "Admin" tile; `admin*` keys across all 7 `app_*.arb`
  + gen-l10n. Parity with web (same 5 sections/caps/endpoints/gating).
  Verify: `flutter analyze` — No issues found. Commit `1ce08f77`.

### P0 Part 5 — Audit log ✅ (backend + web & mobile)
- **`packages/database`**: `AuditLog` schema `{actorId, actorName?, action, targetType, targetId?,
  meta, createdAt}` (+ `createdAt` index), exported.
- **auth-service**: `modules/audit/` (`AuditService.record` + paginated `list` with batch actor-name
  resolution); `AdminService` records workspace/department/member/role mutations (actorId from JWT);
  `GET /admin/audit` (`VIEW_AUDIT_LOG`, paginated).
- **connector-service**: `audit/` (`AuditService` writing the shared `auditlogs` collection) records
  `connector.connect` (workspace scope), `custom_mcp.add`, `sensitive_skill.run`.
- **web**: `AuditLogPanel` paginated list (`useAuditLog` + `keepPreviousData`).
- **Flutter**: `AuditPanel` paginated list (`auditLogProvider` family). audit i18n in all 7+7 locales.
- Verify: `@platform/database` 10, auth-service 32, connector-service 37, web build OK,
  `flutter analyze` clean. Commit `0353253d`.

**→ ✅ P0 COMPLETE. Enterprise foundation (RBAC + admin console both platforms + governed connectors +
audit) is built and green. This is the milestone to demo to the first test company** (needs the live
secrets/infra in §4 to run end-to-end).

### P5 — Gmail + Google Calendar connectors ✅ (backend only; clients catalog-driven, unchanged)
- **connector-service** `src/catalog/catalog.ts`: `adapter` field on entries; gmail/calendar flipped to
  `available:true` with real Google scopes + OAuth config. `oauth.service.ts`: `buildAuthorizeUrl`/
  `exchangeCode` generalized (Google body+form, offline+consent, scope; Notion Basic+JSON+owner kept);
  `persist` computes `expiry_date`.
- **`src/adapters/`**: `ProviderAdapter` interface, `RemoteMcpAdapter` (Notion/custom, unchanged),
  `GoogleRestAdapter` (Gmail send/draft/search + Calendar list/create/suggest, base64url RFC-822, token
  refresh pre-emptive + reactive-on-401), `AdapterRegistryService`, `AdapterModule`. `internal.service`
  delegates to the resolved adapter (naming/sensitive-gate/audit/lastUsedAt unchanged).
- **infra**: `GOOGLE_CLIENT_ID/SECRET` in compose + `.env.example`. ai-service + web + Flutter untouched
  (`mcp__gmail__*`/`mcp__calendar__*` naming preserved; cards appear via catalog).
- Verify: connector-service **49** tests, ai-service **97** (unchanged), build OK, compose config clean.
  Commits `c6608f20`, `7e948666`, `e0bb6257`, `e04346e3`. **Live E2E needs Google creds (see §4).**

---

## 3. What REMAINS — detailed, in build order

> Task 0, all of P0 (Parts 1–5), and **P5 (Gmail + Calendar connectors)** are **DONE** — see §2.
> Next milestones below (each needs a fresh spec + plan).

### P6 — Department-aware group bot
**Goal:** the group bot in department chats answers using only files/context the department + the
asking member may access. This is where **chat-service (Spring Boot/Java) RBAC enforcement** lands
(deferred from Part 2): validate the JWT in Java, read `role`/`perms`/`depts`, scope message/KB
queries by department. ai-service: pass department context + member perms into the agent so RAG +
tools are department-scoped. **Needs a fresh spec + plan (brainstorm first).**

### P7 — Self-host deployment kit
Turnkey `docker compose` (already most of the way) + a bootstrap runbook: set `WORKSPACE_NAME`,
`BOOTSTRAP_OWNER_EMAIL`, generate `CONNECTOR_VAULT_KEY`, `JWT_ACCESS_SECRET`, provider creds; first
boot seeds workspace + roles + owner. Optional Helm chart. Config-driven per-company customization
(branding, feature flags) — no code forks. **Fresh spec + plan.**

### P8 — SSO (OIDC/SAML)
Config-driven enterprise login in auth-service; map IdP groups → PON roles/departments.
**Fresh spec + plan.**

---

## 4. What YOU (the owner) must provide to unblock live runs

These are HARD STOPs — code is done/ready, but live execution needs secrets/infra:

1. **Run infra inside the compose network** (local Mongo is a replica set advertising `mongo:27017`,
   unreachable from the host): `docker compose -f infra/docker-compose/compose.yml up -d`.
   `pnpm connector` alone can't reach Mongo from the host.
2. **auth-service `.env`**: set `WORKSPACE_NAME`, `BOOTSTRAP_OWNER_EMAIL` (your account email so you
   become Owner on first boot), and the existing `JWT_ACCESS_SECRET`.
3. **Notion OAuth app** (for the connector E2E): create at notion.com integrations (Public/OAuth),
   put `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` in `apps/server/connector-service/.env` and
   `infra/docker-compose/.env`. (`CONNECTOR_VAULT_KEY` + `INTERNAL_API_KEY` were already generated
   into those gitignored files this session.)
4. **Google OAuth app** (for P5): Google Cloud project → enable Gmail API + Calendar API → OAuth 2.0
   client → set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. **Anthropic key** for ai-service (`ANTHROPIC_API_KEY`) if not already set — needed for the AI to
   actually run tools.

Live E2E to validate the whole vision once secrets are in: connect Notion on web `/integrations`
→ in chat say "Create a Notion page titled 'PON test'" → confirm the agent calls
`mcp__notion__create_page` and the page appears.

---

## 5. HOW TO RESUME (when you have tokens again)

Open a new session in this repo. Memory auto-loads `MEMORY.md` (it points to the PON pivot +
enterprise model facts). Then paste one of these:

- To continue building: **"Continue PON enterprise from `docs/superpowers/PON-ENTERPRISE-HANDOFF.md`.
  P0 + P5 are done — brainstorm + plan P6 (department-aware group bot) next, then build it. Work
  part-by-part, run tests/builds, show me each part for review."**
- To do the live Notion E2E instead: **"I've added Notion creds + run docker compose. Run the P1
  Notion E2E from the handoff doc §4."**
- To jump to Google connectors: **"Build P5 from `docs/superpowers/plans/2026-06-19-p5-google-connectors.md`."**

I will re-read this handoff + the relevant plan and pick up exactly here. All work stays on branch
`feature/mcp-connector-core` until you decide to open a PR (nothing has been pushed/merged yet).

---

## 6. Quick verification commands (sanity check after resume)
```
pnpm --filter @platform/database test     # 10 tests
pnpm --filter @platform/auth-service test  # 32 tests
pnpm --filter connector-service test       # 37 tests
pnpm --filter ai-service test              # 97 tests
pnpm --filter @platform/web build          # routes incl. /integrations /skills
cd apps/client && flutter analyze          # clean
git log --oneline main..HEAD               # full feature history
```

## 7. Notes / loose ends
- `_workspace/02_backend_report.md` was `git stash`ed at session start (unrelated WIP). `git stash list`
  to recover it on the `hotfix/session-secret-deploy` branch.
- Nothing pushed to remote; no PR opened. Branch is local-only.
- Reports per part: `_workspace/05_p1_mcp_connector_qa.md`, `06_p0_part1_report.md`, `07_p0_part2_report.md`.
- UI/UX mockup (dark-neon, PON branding) reference is the artifact built this session (Integrations,
  custom MCP, Skills, chat). Re-generate from `scratchpad/newera-mockup.html` if needed.
