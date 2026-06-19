# PON Enterprise — Master Handoff & Continuation Guide

**Last updated:** 2026-06-19
**Active branch:** `feature/mcp-connector-core`
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

---

## 3. What REMAINS — detailed, in build order

### ⚠️ Task 0 (do FIRST, small but required) — Client↔server contract fix from Part 2
**Why:** Part 2 removed the `userId` query param from connector-service user-facing endpoints and
now requires a JWT + derives identity from it. The P1 web/Flutter connector clients still send
`?userId=` (now ignored) and assume those endpoints are open. They DO already attach the JWT via
interceptors, so they likely still work, but the dead `userId` params and any capability-driven UI
should be cleaned up.
**Where:**
- Web: `apps/web/lib/api/connector.ts`, `lib/hooks/use-connectors.ts` — drop `userId` args; rely on JWT.
- Flutter: `apps/client/lib/features/integrations/data/connector_repository.dart` — drop `userId`.
**Verify:** `pnpm --filter @platform/web build`; `cd apps/client && flutter analyze`.
**Commit:** `fix(client): drop dead userId param; rely on JWT for connector calls`.

### P0 Part 3 — Admin console (web, Next.js)
**Plan:** outline in `docs/superpowers/plans/2026-06-19-p0-enterprise-foundation.md` §"PART 3".
**Goal:** the enterprise admin UI. Route group `apps/web/app/(main)/admin/`, gated by capabilities
from `GET /me/capabilities` (call auth-service via a new `adminApi` axios instance →
`NEXT_PUBLIC_AUTH_URL`; auth-service is the host of `/admin/*` + `/me/capabilities`).
**Screens (each ≤400 lines, components under `components/admin/`):**
1. **Workspace settings** — name, branding (logo/primaryColor), feature flags, connector allow-list
   (multi-select of catalog ids). Calls `GET/PATCH /admin/workspace`. Gate: `MANAGE_WORKSPACE`.
2. **Departments** — list/create/edit/delete; assign a lead. `GET/POST/PATCH/DELETE /admin/departments`.
   Gate: `MANAGE_DEPARTMENTS`.
3. **Members** — list users; edit a member's role + departments. `GET /admin/members`,
   `PATCH /admin/members/:id`. (Backend already revokes that user's sessions on change.)
   Gate: `MANAGE_MEMBERS`.
4. **Roles & permissions** — list roles; clone a preset; toggle the permission matrix
   (checkbox grid of `Capability` × role). `GET/POST/PATCH /admin/roles`. Owner role read-only.
   Gate: `MANAGE_ROLES`.
5. **Audit log** view — placeholder until Part 5 ships the backend; render "coming soon" or hide if
   `VIEW_AUDIT_LOG` absent.
**Cross-cutting:** add `useCapabilities()` hook (TanStack Query on `/me/capabilities`); a
`<RequireCap cap=...>` wrapper to hide/disable UI; nav entry "Admin" visible only to capable roles.
**i18n:** add `admin.*` keys to ALL 7 `apps/web/messages/*.json`.
**Verify:** `pnpm --filter @platform/web build`.
**Dispatch:** `web-dev` subagent.

### P0 Part 4 — Flutter admin mirror + capability UI gating
**Plan:** outline §"PART 4". **Goal:** mirror Part 3 on mobile (sync rule).
**Where:** `apps/client/lib/features/admin/` (data repo on `authDio`, Riverpod providers, screens),
a `capabilitiesProvider` from `/me/capabilities`, capability-gated widgets, router + nav entries.
**i18n:** `admin*` keys in ALL 7 `lib/l10n/app_*.arb`, then `flutter gen-l10n`.
**Verify:** `cd apps/client && flutter analyze`. **Dispatch:** `mobile-dev`.

### P0 Part 5 — Audit log
**Plan:** outline §"PART 5". **Where:** auth-service (or a shared schema in `packages/database`).
- `AuditLog` schema `{actorId, action, targetType, targetId, meta, createdAt}`.
- `AuditService.record(...)`; call it at privileged mutations in auth-service `admin.service.ts`
  (member/role/department/workspace changes) and in connector-service (workspace connect, custom-MCP
  add, sensitive tool run — emit via the internal API or a small audit client).
- `GET /admin/audit` (paginated, `VIEW_AUDIT_LOG`); wire the Part 3/4 audit screens to it.
**Verify:** auth + connector tests green. **Dispatch:** `backend-dev`, then `web-dev`/`mobile-dev`.

**→ P0 COMPLETE after Part 5. This is the milestone to demo to the first test company.**

### P5 — Gmail + Google Calendar connectors
**Plan:** `docs/superpowers/plans/2026-06-19-p5-google-connectors.md` (fully detailed, 4 tasks).
**Summary:** Google has no public remote MCP, so add a `ProviderAdapter` abstraction in
connector-service (`RemoteMcpAdapter` for Notion/custom, `GoogleRestAdapter` for Gmail/Calendar via
Google REST + OAuth). Tool names stay `mcp__gmail__*`/`mcp__calendar__*` → ai-service + clients
unchanged. Flip the `gmail`/`calendar` catalog entries to `available:true`.
**Dispatch:** `backend-dev`. **Needs Google creds for live E2E (see §4).**

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
  Start with Task 0 (client contract fix) then P0 Part 3 (admin console web). Work part-by-part, run
  tests/builds, show me each part for review."**
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
