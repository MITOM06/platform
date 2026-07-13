# Role-Aware AI Context — Design

**Date:** 2026-07-13
**Status:** Approved (brainstorming) — pending implementation plan
**Supersedes:** the per-conversation "AI Memory" concept (evolves it; does not keep it as-is)

---

## 1. Problem & Motivation

PON is a self-hosted, single-tenant-per-deployment **B2B enterprise AI-assistant platform**
(Workspace → Departments → Members → Role). The assistant exists to help members do their
work, which means it must understand **who the user is, what they work on, and the relevant
company context — filtered by the user's role**.

Today the only persistent "memory" is a **per-conversation** semantic fact store
(`FactExtractorService` + `remember_fact` tool + Qdrant `ai_memory` + Mongo `ai_memory`,
surfaced at `/ai-memory`). Two gaps:

1. **Scoped per conversation** — a fact taught in chat A is not recalled in chat B, so the
   assistant never feels like it "knows" the user. This is the root of the user complaint that
   the AI Memory UI shows nothing after they told the AI who they are.
2. **No organizational context** — the assistant has no notion of the company, the user's
   department, role, current project, or any role-gated sensitive company information.

This design replaces the per-conversation "AI Memory" with a **global, per-user, role-aware
"AI Context"** made of three layers, editable per an RBAC + department-scope permission model.

## 2. Goals / Non-Goals

**Goals**
- A per-user **AI Context** the assistant reads every turn: personal identity/role/project +
  self-authored style + AI-learned facts + role-gated company/department context.
- **Curated text context** (not live data access): admins/managers author company &
  department context entries; each entry can be tagged with a required capability so only
  sufficiently-privileged users' assistants receive it.
- **Editability governed by RBAC + department scope**: hard fields (role, project) are set by
  superiors; soft fields (style, preferences) are self-editable.
- Make AI-learned facts **global per-user** so they recall across all conversations.
- A UI where each editable section has an explicit **"Update"** action (Claude/Gemini-style
  "who you are" context editor).

**Non-Goals (explicitly out of scope for this spec)**
- Live, role-scoped access to *actual* company data (HR records, other users' data, arbitrary
  KB) — that is the future "group bot data-scoped by role" workstream, a separate spec.
- Numeric role ranks. Authority stays capability-based + department-scoped (matches existing
  RBAC). Sensitivity gating is expressed via capabilities, not ranks.
- Cross-company / multi-tenant concerns (PON is single-tenant per deployment; no `orgId`).

## 3. Data Model (shared Mongo `platform`)

### 3.1 `ai_context_entries` — company & department context notes
```
{
  _id: ObjectId,
  scope: 'company' | 'department',
  scopeId: string | null,               // null for company; departmentId for department
  label: string,                        // short title, e.g. "Q3 Roadmap"
  text: string,                         // the context content
  requiredCapability: Capability | null // null = public; else gate to holders of this cap
  createdBy: string,                    // userId
  updatedBy: string,                    // userId
  createdAt: Date,
  updatedAt: Date
}
```
`requiredCapability` implements the "min-role" sensitivity gate in an RBAC-native way (no
rank concept). UI tiers map to it:
- **Public** → `null`
- **Internal** → `VIEW_INTERNAL_CONTEXT`
- **Confidential** → `VIEW_CONFIDENTIAL_CONTEXT`

### 3.2 `ai_user_context` — one doc per user
```
{
  userId: string (unique),
  jobTitle: string,          // HARD — superior-editable only
  projects: string[],        // HARD — superior-editable only
  style: string,             // SOFT — self-editable
  preferences: string,       // SOFT — self-editable
  updatedBy: string,
  updatedAt: Date
}
```
Role name and department names are **not stored here** — they are derived from the existing
`user.roleId → Role.name` and `user.departmentIds → Department.name`.

### 3.3 Learned facts — existing ai-service memory, re-scoped global per-user
No new collection. The existing Qdrant `ai_memory` points already store `userId` in their
payload; the Mongo `ai_memory` canonical list becomes keyed by `userId` (see §6).

## 4. RBAC — new capabilities

Added to `packages/database/src/rbac/capabilities.ts` and the `PRESET_ROLES` matrix
(`preset-roles.ts`). Additive; Owner auto-grants via `buildFullMatrix`.

| Capability | Meaning | Owner | Admin | Manager | Member |
|---|---|---|---|---|---|
| `MANAGE_AI_CONTEXT` | Edit company/department context entries | ✅ | ✅ | own dept* | ❌ |
| `VIEW_INTERNAL_CONTEXT` | Receive `Internal`-tier entries in prompt | ✅ | ✅ | ✅ | ❌ |
| `VIEW_CONFIDENTIAL_CONTEXT` | Receive `Confidential`-tier entries in prompt | ✅ | ✅ | ❌ | ❌ |

\* Manager editing **their own department's** entries and same-department members' hard fields
is enforced at the service layer (department-scope), consistent with the existing
preset-roles note that Manager's "own dept" authority is not a workspace-wide capability.

### 4.1 Edit authority (enforced in auth-service via `RequirePermission` + service-layer scope)
- **Company entry** → `MANAGE_AI_CONTEXT`.
- **Department entry** → `MANAGE_AI_CONTEXT` (workspace-wide) **OR** Manager of that department.
- **User hard fields** (`jobTitle`, `projects`) → `MANAGE_MEMBERS` (Admin/Owner) **OR** Manager
  of the target user's department. The user **cannot** edit their own hard fields.
- **User soft fields** (`style`, `preferences`) → the owning user only.

### 4.2 Read/visibility (which entries feed user U's prompt)
- Company entry: include iff `requiredCapability == null` OR U's `perms` contains it.
- Department entry: include iff U ∈ that department AND (`requiredCapability == null` OR U holds it).
- User context: U's own doc is always included for U.

## 5. Service Ownership (Approach A — split by authority)

- **auth-service** — new `ai-context/` module: CRUD for `ai_context_entries` and
  `ai_user_context`, every mutation behind the existing RBAC guards + department-scope checks.
  Web/Flutter call auth-service for the context viewer and the admin/manager editors.
- **chat-service** — when publishing to the `ai.requests` queue, additionally include
  `roleId`, `perms: string[]`, `departmentIds: string[]` (already available from the validated
  JWT). **Additive & backward-compatible** — ai-service treats missing values as
  "Member / no perms / no departments".
- **ai-service** — reads the two context collections directly from the shared `platform` DB
  (same pattern as chat-service reading `user_blocks` / `kb_documents`), cached per-user with a
  short TTL (~60s) to keep the hot path off the DB. Owns prompt assembly + the re-scoped memory.

## 6. Learned-Facts Re-Scoping (global per-user)

The elegant part: Qdrant `ai_memory` points **already** carry `userId` in payload, so switching
the retrieval/list/dedup filter from `{userId, conversationId}` → `{userId}` makes all existing
facts global immediately — **no vector migration**.

Changes in `apps/server/ai-service/src/memory/`:
- `MemoryVectorService.retrieve` / `nearest` / `listFacts`: filter by `userId` only.
  `conversationId` stays in payload for provenance but is no longer a filter key.
- `MemoryService.addFacts` / `retrieveRelevantFacts`: drop the `conversationId` scoping;
  dedup is now per-user (a fact taught anywhere dedupes against the user's whole set).
- `ai_memory` Mongo doc becomes keyed by `userId` (canonical `keyFacts` rebuilt from Qdrant by
  userId). One-time migration script collapses existing per-conversation docs into per-user
  (union `keyFacts`, keep most-recent `summary`); or allow self-heal on next write.
- `remember_fact` tool + `FactExtractorService`: write with `userId` scope (the tool added on
  2026-07-12 keeps working; only its scope changes).

## 7. Prompt Assembly (ai-service `context-builder.service.ts`)

Each turn, prepend a bounded **"About the user & their organization"** block:
1. Read `userId`, `perms`, `departmentIds` from the `ai.requests` payload.
2. Fetch: company entries (perms-filtered) + department entries (membership + perms) +
   `ai_user_context` for U + derived role/department names + global learned facts.
3. Compose a length-capped text block (protect token budget). Company/department/user-profile
   text is trusted (admin/superior authored); learned facts keep the existing
   `sanitizeUntrusted` treatment.
4. Inject into the volatile grounding context (so role/context changes take effect without
   busting the cached persona prefix). Fail-soft: on read error, skip the block, never crash
   (same try/catch pattern already in `context-builder`).

## 8. chat-service surface changes

- `AiRedisPublisher` (ai.requests publish): add `roleId`, `perms`, `departmentIds`.
- `/api/ai/memories` learned-facts endpoint becomes per-user (returns the single aggregate for
  the caller). The AI Context page reads structured context from **auth-service** and learned
  facts from **chat-service** (existing proxy), keeping the current media/URL humanization rules.

## 9. UI (web + Flutter — cross-platform sync rule)

Rename `/ai-memory` → `/ai-context` (redirect the old route). Sections:
1. **Identity & organization** — read-only: role, department, job title, current projects.
2. **Response style** — self-editable textarea + presets, with an **Update** button.
3. **What the AI has learned** — list of learned facts; delete individually.
4. **Company / department context** — read-only, already role-filtered (only entries the
   user's capabilities allow).

**Superior/admin surfaces (new):**
- In the Members management area (Admin / dept-Manager): per-member "Edit AI context"
  (jobTitle, projects) with an **Update** button.
- A "Company AI context" editor: CRUD entries, choose tier (Public / Internal / Confidential).

All user-facing text obeys the no-raw-system-data rule and i18n rules (web `messages/*.json`,
mobile `lib/l10n/app_*.arb`, 7 locales).

## 10. Error Handling
- Unauthorized edit → `403` from the RBAC guard.
- ai-service context read failure → degrade gracefully (omit the block), never crash the turn.
- Injected context is length-capped to bound token usage.

## 11. Testing
- **auth-service**: guard/service tests for edit authority (self vs same-dept Manager vs Admin
  vs Member) and visibility filtering by capability tier.
- **ai-service**: context-builder includes/excludes entries by `perms`; global (per-user)
  memory retrieval; `remember_fact` + extractor still write and now recall across conversations.
- **web / Flutter**: build green + section rendering + sync-check parity.

## 12. Phased Implementation (single spec, multi-part plan)
- **P1** — RBAC (3 capabilities + preset matrix) + auth-service data model + CRUD + guards.
- **P2** — ai-service: extend `ai.requests` payload (chat-service) + prompt assembly +
  re-scope learned facts to global per-user + migration script.
- **P3** — web UI (AI Context page + admin/manager editors).
- **P4** — Flutter UI (mirror of P3).

## 13. Migration / Rollout Notes
- New capabilities are additive; empty context ≡ current behavior (assistant simply lacks org
  context), so rollout is non-breaking.
- No Qdrant migration (filter change only). One-time Mongo `ai_memory` collapse script for
  history, otherwise self-heals.
- `ai.requests` payload additions are backward-compatible.
