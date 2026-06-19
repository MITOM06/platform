# PON — Enterprise Reframe — Vision & Revised Architecture

**Date:** 2026-06-19
**Status:** DRAFT — pending owner approval of the deployment-model assumption
**Owner:** Tran Phuc Khang
**Supersedes the framing of:** `2026-06-19-pon-mcp-connector-core-design.md` (P1 code stands; it gets retrofitted, not discarded)

---

## 0. The pivot in one line

PON is a **self-hosted, single-tenant-per-deployment enterprise AI-assistant platform**, sold to
individual companies and deployed on (or for) each company's own infrastructure — not a shared
multi-tenant SaaS.

## 1. Deployment model (the linchpin)

- **One deployment = one company.** Each customer runs their own PON instance (their server, or a
  dedicated environment we provision). Companies are isolated **at the infrastructure level** — the
  strongest isolation, matching "bảo mật cao, không đại trà".
- **White-glove onboarding:** a small team helps each company deploy & configure.
- **Per-company customization:** branding, enabled connectors, feature flags, SSO — all
  **config-driven**, not code forks.
- **Consequence:** we do **NOT** add a cross-company `orgId` foreign key to every record. Each
  instance is a single **Workspace** (= the company). Isolation is the deployment boundary.

### What this means for the codebase
- Tenancy = deployment. No multi-org query scoping. Far simpler + safer than SaaS multi-tenancy.
- The "organization" is a **singleton Workspace config** doc (company name, logo, SSO, feature
  flags), not a multiplied entity.
- The real internal grouping unit is the **Department**.

## 2. Internal structure (within one company instance)

```
Workspace (the company — singleton config)
 └─ Departments (phòng ban)
     └─ Members (users)  ──has──>  Role
 └─ Roles (preset templates, admin-customizable)
 └─ Group chats (per department / cross-department)
 └─ Connectors (workspace-level + personal, governed)
```

- **Workspace:** company identity + global config (branding, SSO, enabled features, connector
  allow-list, default model limits).
- **Department:** named group of members; owns department group chats and department-scoped
  knowledge/files. The group bot is department-aware.
- **Member:** a user; belongs to one or more departments; carries a Role.
- **Role:** ships as **preset templates** (Owner / Admin / Manager / Member) with a
  **permission matrix stored as data**; **admin can clone & customize** roles. (Hybrid RBAC.)

## 3. RBAC — permission matrix (data, not hardcoded)

Permissions are boolean/enum capabilities checked at every service. Initial set:

| Capability | Owner | Admin | Manager | Member |
|---|---|---|---|---|
| Manage workspace config / billing | ✓ | – | – | – |
| Manage departments & members | ✓ | ✓ | own dept | – |
| Manage roles & permissions | ✓ | ✓ | – | – |
| Connect **workspace** connectors | ✓ | ✓ | – | – |
| Add **custom MCP** server | ✓ | ✓ | – | – |
| Connect **personal** connectors (from allow-list) | ✓ | ✓ | ✓ | ✓ (if allowed) |
| Use AI personal assistant | ✓ | ✓ | ✓ | ✓ |
| Use department group bot | ✓ | ✓ | ✓ | ✓ |
| Run "sensitive" skills (send mail, external writes) | ✓ | ✓ | ✓ | gated |
| View audit log | ✓ | ✓ | own dept | – |

Roles are templates; an admin may clone "Member" → "Member (read-only)" and toggle capabilities.
Enforcement: each service reads `role` + `permissions` + `departmentIds` from the JWT and guards.

## 4. Identity & token model

- **auth-service owns identity** (users, JWT) — now extended with Workspace / Department / Role /
  permission matrix. (`auth-guard.md` grants full access.)
- **JWT access token claims** gain: `role`, `permissions` (or a role ref resolved to permissions),
  `departmentIds`. `JWT_ACCESS_SECRET` stays identical across services (unchanged rule).
- Every service (chat, ai, connector) enforces capabilities from the JWT — no service trusts the
  client for role.

## 5. AI assistants in the enterprise

- **Personal assistant** (exists): per-user, uses that user's permitted connectors + skills,
  scoped to what the user may access.
- **Department group bot** (P6, reframed): lives in department chats; **only sees files/context
  the department + the asking member are permitted to see**. A low-level employee asking the bot
  cannot pull data their role forbids. Data-access checks happen server-side, per message.

## 6. Connector governance (Hybrid + governance — confirmed)

- **Workspace connectors:** admin connects shared company accounts (e.g. Google Workspace, Notion
  team). Available to members per role/department.
- **Personal connectors:** members connect their own accounts, but only from the
  **admin-curated allow-list**.
- **Custom MCP:** **admin-only** (security — prevents low-level staff pointing the AI at arbitrary
  servers / data exfiltration).
- The P1 connector-service is reused; we add `scope: 'workspace' | 'personal'`, an allow-list,
  and capability checks on connect / custom-MCP / tool-use.

## 7. Security posture (enterprise)

- Infra-level tenant isolation (separate deployments).
- Encrypted secret vault (exists, AES-256-GCM).
- RBAC enforced server-side at every service via JWT claims.
- **Audit log** of privileged actions (member/role/connector changes, sensitive skill runs).
- SSO (OIDC/SAML) — later phase, config-driven.
- Department-scoped data access for the group bot.

## 8. Revised roadmap

| Phase | Name | Status | Notes |
|---|---|---|---|
| **P0** | **Enterprise Foundation** | NEW — do first | Workspace config, Departments, Members, **RBAC (preset + customizable)**, JWT claims, permission guards across services, audit log, admin console (web). |
| **P1** | MCP Connector Core | ✅ built → **retrofit** | Add `scope` (workspace/personal), allow-list, custom-MCP=admin-only, capability checks. |
| **P5** | Gmail + Calendar connectors | planned | Resume after P0; gated by governance. |
| **P6** | Department-aware group bot | reframed | Bot scoped to department + member permissions. |
| **P7** | Self-host deployment kit | NEW | Turnkey docker-compose/Helm, bootstrap first admin, config reference, white-glove runbook. |
| **P8** | SSO (OIDC/SAML) | NEW | Config-driven enterprise login. |

## 9. What P0 (Enterprise Foundation) contains — the next spec

1. **Workspace** singleton config (model + bootstrap on first deploy + admin settings).
2. **Department** CRUD; member↔department membership.
3. **Role & permission matrix**: seed preset roles; admin clone/edit; persistence.
4. **auth-service**: extend user with role + departments; **add claims to JWT**.
5. **Shared permission guard** usable by chat/ai/connector (Nest guard + a Flutter/web capability map).
6. **Admin console (web)**: departments, members, roles/permissions, connector allow-list, audit log.
7. **Audit log** service + write points for privileged actions.
8. **Flutter**: admin screens mirror (per sync rule) + capability-driven UI gating.

Each becomes a task in the P0 implementation plan.

## 10. Open assumptions to confirm
- **A1 (linchpin):** self-hosted, one-deployment-per-company (Section 1). If instead you want a
  shared multi-tenant SaaS, Sections 1–4 change materially.
- **A2:** preset roles = Owner/Admin/Manager/Member is the right starting set for the companies you
  target (adjustable later via admin UI regardless).
- **A3:** billing is **out of scope** for the product itself (sold per-deployment via contract, not
  in-app seats). Revisit if you want in-app billing.
