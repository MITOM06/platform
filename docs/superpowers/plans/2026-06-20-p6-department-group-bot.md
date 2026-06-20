# P6 — Department-aware Group Bot — Plan

**Goal:** the group bot in a department chat answers using only the data the
department + the asking member may access. This lands **chat-service (Spring
Boot/Java) RBAC enforcement** (deferred from P0 Part 2) and department-scoped
RAG/tools in ai-service.

**Status:** Part 1 in progress. Parts 2–3 have open architecture decisions (see
§"Open decisions") — do NOT build them until the owner picks an option.

---

## Part 1 — chat-service JWT RBAC enforcement ✅ (architecture-neutral, build first)
**Why:** every other P6 piece needs the member's `role`/`perms`/`depts` available
inside the Java service. The JWT already carries them (auth-service embeds the
claims); chat-service only extracts `sub` today.
**Where:** `apps/server/chat-service/src/main/java/.../security/`
- `JwtUtil`: add `extractRole`, `extractPerms`, `extractDepts` (read `role`,
  `perms[]`, `depts[]` claims; tolerate their absence for legacy tokens).
- `UserPrincipal`: carry `role`, `perms`, `depts`; map `perms` →
  `SimpleGrantedAuthority("PERM_<CAP>")` so `@PreAuthorize("hasAuthority(...)")`
  works; add `hasPermission(cap)` + `inDepartment(id)` helpers.
- `JwtAuthenticationFilter`: populate the enriched principal.
- (optional) `@EnableMethodSecurity` so controllers can gate with `@PreAuthorize`.
**Verify:** `mvn -q -pl . compile` (+ existing tests). No behavior change for
existing endpoints (claims are additive).

## Part 2 — Department ↔ conversation link + scoped reads  ⛔ NEEDS DECISION
Associate a group conversation with a department, then scope message/KB reads so
a member only sees department data they're entitled to. Requires a schema/route
decision — see §"Open decisions" A.

## Part 3 — ai-service department context  ⛔ NEEDS DECISION (depends on Part 2)
Pass department id + member perms into the agent so RAG retrieval + tool exposure
are department-scoped (only KB docs of that department; sensitive tools still
gated by `RUN_SENSITIVE_SKILL`). Requires KB-tagging decision — see §"Open
decisions" B.

---

## Open decisions (HARD STOP — owner picks before Parts 2–3)
**A. How does a conversation belong to a department?**
- A1: add `departmentId` to the `Conversation` document; a department has one (or
  more) group chats created/owned by it. Simplest; explicit.
- A2: derive membership from participants' `departmentIds` (no schema change);
  fuzzier, no single owning department.

**B. How is KB/RAG scoped to a department?**
- B1: add `departmentId` to `kb_documents`; retrieval filters by the conversation's
  department. Clean isolation.
- B2: keep KB per-conversation only (existing), no department tag; "department
  scope" = whatever is attached to that group chat. Less work, weaker isolation.

(Recommended: A1 + B1 — explicit department ownership + isolated KB — matches the
enterprise isolation model, but it touches chat-service schema + ai-service RAG.)
