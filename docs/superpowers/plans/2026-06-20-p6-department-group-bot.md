# P6 — Department-aware Group Bot — Plan

**Goal:** the group bot in a department chat answers using only the data the
department + the asking member may access. This lands **chat-service (Spring
Boot/Java) RBAC enforcement** (deferred from P0 Part 2) and department-scoped
RAG/tools in ai-service.

**Status:** ✅ DONE — Parts 1–3 built. Owner picked **A1 + B1** (explicit
department ownership + dept-tagged KB). Live verification needs a deployed stack
+ a department group chat with KB; code builds/tests green.

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

## Part 2 — Department ↔ conversation link + KB tagging ✅ (A1 + B1)
- `Conversation.departmentId` (indexed) + `CreateGroupRequest`/`createGroup` set it.
- `KbDocument.departmentId` (indexed), inherited from the conversation on upload;
  `kb:process` Redis payload carries it.
- `AiRequestPayload.departmentId`; `AiRedisPublisher` resolves it from the
  conversation. Null-tolerant for personal chats. (chat-service, mvn green.)

## Part 3 — ai-service department-scoped RAG ✅
- `AiRequestPayload`/`KbProcessPayload`/`ToolContext`/`RequestContext` +
  `departmentId`; `kb-document.schema` + departmentId.
- `getReadyDocumentIds(conversationId, departmentId?)`: department group chat →
  whole-department KB; else conversation-scoped. `context-builder` +
  `search_knowledge_base` tool thread it through. Sensitive tools still gated by
  `RUN_SENSITIVE_SKILL` in connector-service (unchanged). (ai-service, 97 tests green.)

> Note: the bot's tool exposure is already member-scoped — connector-service
> resolves the caller's perms from Mongo independently of chat context — so no
> extra perms plumbing was needed for department scoping.

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
