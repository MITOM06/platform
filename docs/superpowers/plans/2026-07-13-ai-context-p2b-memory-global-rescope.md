# AI Context — P2b: Learned-Facts Global Per-User Re-Scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-learned facts **global per user** so a fact taught in conversation A is recalled in conversation B — fixing the core complaint that the assistant "never remembers who I am." Retrieval, dedup, and the canonical list all switch from `{userId, conversationId}` scoping to `{userId}`.

**Architecture:** The Qdrant `ai_memory` points **already** carry `userId` in payload, so switching the retrieval/dedup/list filter from `{userId, conversationId}` → `{userId}` makes existing facts global with **no vector migration**. The Mongo `ai_memories` documents stay per-conversation (minimal churn), but their canonical `keyFacts` are now rebuilt from the **per-user** vector union, and the chat-service `/api/ai/memories` endpoint aggregates the caller's docs into ONE deduped list. `conversationId` stays in the vector payload for provenance and remains the key for delete-on-conversation-removal.

**Tech Stack:** NestJS 10 + `@nestjs/mongoose` + Qdrant client (ai-service); Spring Boot 3 (chat-service `/api/ai/memories`); Jest; JUnit; pnpm; Maven.

## Global Constraints

- Package manager: **pnpm** (JS/TS) / **Maven** (Java). ai-service ≤ 300 lines/file; chat-service ≤ 500.
- After **every** Java edit: `mvn spotless:apply` (google-java-format bound to test-compile).
- Constructor injection only; `ConfigService` for env; NestJS `Logger` (never `console.log`).
- **No vector migration.** `conversationId` stays in the Qdrant payload; only the *filter* changes.
- Fail-soft everywhere: an empty/missing Qdrant collection or Mongo hiccup must return `[]`/skip, never crash a turn (the existing services already do this — preserve it).
- Depends on P2a being merged first (types/threading). If executed independently, it still stands alone: it does not touch `AiRequestPayload` claims.

---

### Task 1: Retrieve / dedup / list by `userId` only (vector store)

**Files:**
- Modify: `apps/server/ai-service/src/memory/memory-vector.service.ts`
- Test: `apps/server/ai-service/src/memory/memory-vector.service.spec.ts` (create if absent)

**Interfaces:**
- Produces: `MemoryVectorService.retrieve(userId, queryVector, topN)`, `.nearest(userId, vector)`, `.listFacts(userId)` — `conversationId` **removed** from these three signatures. `.upsertFact(userId, conversationId, fact)` and `.deleteConversation(conversationId)` **keep** `conversationId` (provenance + delete key). New private `userScopeFilter(userId)` replaces `scopeFilter(userId, conversationId)` for the three read paths.

- [ ] **Step 1: Write the failing test**

`memory-vector.service.spec.ts` — mock the Qdrant client to assert the filter shape:
```ts
import { MemoryVectorService } from './memory-vector.service';

function svcWith(searchImpl: any) {
  const config = { get: () => undefined } as any;
  const s = new MemoryVectorService(config);
  // Replace the private client with a mock (cast through any).
  (s as any).client = {
    getCollection: jest.fn().mockResolvedValue({}),
    search: searchImpl,
    scroll: jest.fn().mockResolvedValue({ points: [] }),
  };
  (s as any).ensured = true;
  return s;
}

describe('MemoryVectorService — per-user scope', () => {
  it('retrieve filters by userId only (no conversationId)', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const s = svcWith(search);
    await s.retrieve('u1', [0.1, 0.2], 5);
    const filter = search.mock.calls[0][1].filter;
    expect(filter.must).toEqual([{ key: 'userId', match: { value: 'u1' } }]);
  });

  it('nearest filters by userId only', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const s = svcWith(search);
    await s.nearest('u1', [0.1, 0.2]);
    const filter = search.mock.calls[0][1].filter;
    expect(filter.must).toEqual([{ key: 'userId', match: { value: 'u1' } }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @platform/ai-service test -- memory-vector.service`
Expected: FAIL — `retrieve`/`nearest` still require a `conversationId` arg (arity) and filter includes `conversationId`.

- [ ] **Step 3: Implement**

In `memory-vector.service.ts`:
1. Replace `scopeFilter`:
```ts
  private userScopeFilter(userId: string) {
    return { must: [{ key: 'userId', match: { value: userId } }] };
  }
```
2. `retrieve(userId: string, queryVector: number[], topN: number)` — drop `conversationId` param; use `this.userScopeFilter(userId)`.
3. `nearest(userId: string, vector: number[])` — drop `conversationId` param; use `this.userScopeFilter(userId)`.
4. `listFacts(userId: string)` — drop `conversationId` param; use `this.userScopeFilter(userId)`.
5. `upsertFact(userId, conversationId, fact)` — **unchanged** (still writes `conversationId` into payload).
6. Update the class doc-comment: "Points carry `{userId, conversationId}` in payload; **reads filter by `userId` only** (global per-user). `conversationId` is retained for provenance and conversation-delete."

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @platform/ai-service test -- memory-vector.service`
Expected: PASS. (The service will not compile until `MemoryService` — Task 2 — updates its calls; if the build blocks the test, do Task 2 Step 3's call-site edits in the same red-green cycle. Prefer committing Tasks 1–2 together if the compiler couples them.)

- [ ] **Step 5: Commit (may be combined with Task 2)**

```bash
git add apps/server/ai-service/src/memory/memory-vector.service.ts apps/server/ai-service/src/memory/memory-vector.service.spec.ts
git commit -m "feat(ai): memory vector reads scoped per-user (global recall, no migration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `MemoryService` — per-user retrieval, dedup, canonical rebuild

**Files:**
- Modify: `apps/server/ai-service/src/memory/memory.service.ts`
- Modify: `apps/server/ai-service/src/memory/memory.service.spec.ts`

**Interfaces:**
- Produces: `retrieveRelevantFacts(userId, queryVector)` — `conversationId` **removed**. `addFacts(conversationId, userId, facts, summary, messageCount, source?)` — signature **unchanged** (still writes a per-conversation Mongo doc) BUT dedup + canonical rebuild now call the per-user vector methods (`nearest(userId, ...)`, `listFacts(userId)`). `getMemory(conversationId)`, `deleteMemory(conversationId)`, `incrementMessageCount(conversationId)`, `upsertMemory(...)` — **unchanged**.

- [ ] **Step 1: Update the failing tests**

In `memory.service.spec.ts`, find the `retrieveRelevantFacts` and `addFacts` tests. Update `retrieveRelevantFacts` calls to drop `conversationId` and assert `vectorStore.retrieve` is called with `(userId, queryVector, <n>)`. Update `addFacts` tests so the `nearest`/`listFacts` mocks are asserted to be called with `(userId, ...)` (userId first, no conversationId). Concretely, add:
```ts
  it('retrieveRelevantFacts queries the vector store per-user', async () => {
    vectorStore.retrieve.mockResolvedValue([{ text: 'Name is Khang', createdAt: Date.now(), score: 0.9 }]);
    const res = await service.retrieveRelevantFacts('u1', [0.1, 0.2]);
    expect(vectorStore.retrieve).toHaveBeenCalledWith('u1', [0.1, 0.2], expect.any(Number));
    expect(res[0].text).toBe('Name is Khang');
  });
```
(Match the existing spec's mock/harness style; if `vectorStore` is a jest-mocked object there, extend it with `retrieve`/`nearest`/`listFacts` mocks accordingly.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @platform/ai-service test -- memory.service`
Expected: FAIL — arity mismatch / mock called with an unexpected `conversationId` argument.

- [ ] **Step 3: Implement**

In `memory.service.ts`:
1. `retrieveRelevantFacts(userId: string, queryVector: number[])` — drop `conversationId`; call `this.vectorStore.retrieve(userId, queryVector, Math.max(this.topFacts * 2, this.topFacts))`.
2. In `addFacts`, change the dedup lookup to `const nearest = await this.vectorStore.nearest(userId, vector);` and the canonical rebuild to `const all = await this.vectorStore.listFacts(userId);` (both drop `conversationId`). The `upsertFact(userId, conversationId, ...)` call **stays** (writes provenance). The Mongo `findOneAndUpdate({ conversationId }, ...)` **stays** — every conversation doc for this user now stores the same per-user `keyFacts` union, which the endpoint (Task 4) dedups.
3. Update the doc-comment on `addFacts`: "Dedup + canonical rebuild are per-**user** (a fact taught in any conversation dedupes against the user's whole set and is recalled everywhere)."

- [ ] **Step 4: Update the caller in `context-builder.service.ts`**

`buildVolatileContext` calls `this.memoryService.retrieveRelevantFacts(userId, conversationId, queryVector)`. Change to `retrieveRelevantFacts(userId, queryVector)`. (The surrounding try/catch + `sanitizeUntrusted` treatment is unchanged.)

- [ ] **Step 5: Run to verify it passes + build**

```bash
pnpm --filter @platform/ai-service test -- memory.service
pnpm --filter @platform/ai-service build
```
Expected: PASS + clean build.

- [ ] **Step 6: Commit**

```bash
git add apps/server/ai-service/src/memory/memory.service.ts apps/server/ai-service/src/memory/memory.service.spec.ts apps/server/ai-service/src/ai/context-builder.service.ts
git commit -m "feat(ai): per-user learned-fact retrieval + dedup (recall across conversations)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Update remaining callers (fact-extractor, remember_fact, `/memory` command)

**Files:**
- Modify: `apps/server/ai-service/src/tools/remember-fact.tool.ts` (+ its spec)
- Modify: `apps/server/ai-service/src/ai/fact-extractor.service.ts`
- Modify: `apps/server/ai-service/src/ai/ai.service.ts` (the `/memory` inspection command copy)

**Interfaces:**
- Consumes: `MemoryService.addFacts` (unchanged signature — these callers already pass `conversationId, userId, ...`). No signature change needed; this task verifies nothing broke and refreshes user-facing copy that now implies global memory.

- [ ] **Step 1: Confirm no call-site breakage**

`remember-fact.tool.ts` and `fact-extractor.service.ts` call `memoryService.addFacts(conversationId, userId, ...)` — signature unchanged in Task 2, so they compile as-is. Run their specs to confirm:
```bash
pnpm --filter @platform/ai-service test -- remember-fact.tool
pnpm --filter @platform/ai-service test -- fact-extractor
```
Expected: PASS (no code change yet).

- [ ] **Step 2: Refresh the `remember_fact` description to reflect global scope**

In `remember-fact.tool.ts`, the tool `description` currently says facts are recalled "in later messages." Tighten it to global recall — change "so you can recall them in later messages" → "so you can recall them **in any conversation with this user later**." (Copy-only; keeps behavior.) Update the matching assertion in `remember-fact.tool.spec.ts` if it asserts on the description substring.

- [ ] **Step 3: Fix the `/memory` command copy in `ai.service.ts`**

The `/memory` / `/ai-memory` branch prints "Ký ức của cuộc trò chuyện này" (memory of **this conversation**). Since memory is now global per-user, change the header to "Những gì tôi đã ghi nhớ về bạn" and the empty notice `MEMORY_EMPTY_NOTICE` from "Chưa có ký ức nào được lưu trong cuộc trò chuyện này" → "Tôi chưa ghi nhớ điều gì về bạn. Hãy chat thêm để tôi học về bạn." (No logic change — `getMemory(conversationId)` still returns this conversation's doc, which now carries the per-user union `keyFacts`.)

- [ ] **Step 4: Run affected specs + build**

```bash
pnpm --filter @platform/ai-service test -- remember-fact.tool
pnpm --filter @platform/ai-service build
```
Expected: PASS + clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/server/ai-service/src/tools/remember-fact.tool.ts apps/server/ai-service/src/tools/remember-fact.tool.spec.ts apps/server/ai-service/src/ai/fact-extractor.service.ts apps/server/ai-service/src/ai/ai.service.ts
git commit -m "feat(ai): global-memory copy for remember_fact + /memory command

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `/api/ai/memories` returns ONE per-user aggregate

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/AiMemoryController.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/controller/AiMemoryControllerTest.java` (create if absent)

**Interfaces:**
- Produces: `GET /api/ai/memories` returns a single aggregated `AiMemoryResponse` for the caller — union of `keyFacts` across the caller's conversation docs (deduped, preserving most-recent-first order) + the most-recently-updated `summary` + total `messageCount`. `GET /api/ai/memories/{conversationId}` and `DELETE` are unchanged.

- [ ] **Step 1: Read the current controller**

Read `AiMemoryController.java`. It maps `GET /api/ai/memories` → `aiMemoryRepository.findByUserId(principal.getName())` → `List<AiMemoryResponse>`. Note the exact `AiMemoryResponse` shape (fields) and the `toResponse` mapper.

- [ ] **Step 2: Write the failing test**

`AiMemoryControllerTest.java`:
```java
package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.User;

@ExtendWith(MockitoExtension.class)
class AiMemoryControllerTest {

  @Mock AiMemoryRepository repo;

  private AiMemory mem(String conv, List<String> facts, String summary, Instant updated, int count) {
    AiMemory m = new AiMemory();
    m.setConversationId(conv);
    m.setUserId("u1");
    m.setKeyFacts(facts);
    m.setSummary(summary);
    m.setUpdatedAt(updated);
    m.setMessageCount(count);
    return m;
  }

  @Test
  void aggregatesAllConversationsIntoOnePerUserMemory() {
    when(repo.findByUserId("u1"))
        .thenReturn(
            List.of(
                mem("cA", List.of("Name is Khang", "Likes Flutter"), "older", Instant.ofEpochSecond(100), 3),
                mem("cB", List.of("Likes Flutter", "Works on PON"), "newest", Instant.ofEpochSecond(200), 5)));

    AiMemoryController ctrl = new AiMemoryController(repo);
    var res = ctrl.getMine(new User("u1", "", List.of())); // adapt principal type to the real signature

    assertThat(res.keyFacts()).containsExactly("Works on PON", "Likes Flutter", "Name is Khang"); // most-recent-first, deduped
    assertThat(res.summary()).isEqualTo("newest");
    assertThat(res.messageCount()).isEqualTo(8);
  }
}
```

> Adapt the principal argument + the endpoint method name/return type to the real controller (Step 1). If `AiMemoryResponse` is not a record with `keyFacts()/summary()/messageCount()` accessors, assert against its actual getters. If the method currently returns `List<AiMemoryResponse>`, this test drives the change to a single `AiMemoryResponse`.

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/server/chat-service && mvn -q -Dtest=AiMemoryControllerTest test`
Expected: FAIL — returns a list, not an aggregate.

- [ ] **Step 4: Implement the aggregation**

In `AiMemoryController.java`, change the `GET /api/ai/memories` handler to build one `AiMemoryResponse`:
```java
    List<AiMemory> memories = aiMemoryRepository.findByUserId(principal.getName());
    // Global per-user view: union keyFacts (most-recent conversation first, deduped),
    // newest summary, total message count.
    memories.sort(
        java.util.Comparator.comparing(
                AiMemory::getUpdatedAt, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
            .reversed());
    java.util.LinkedHashSet<String> facts = new java.util.LinkedHashSet<>();
    for (AiMemory m : memories) {
      if (m.getKeyFacts() != null) facts.addAll(m.getKeyFacts());
    }
    String summary = memories.isEmpty() ? "" : memories.get(0).getSummary();
    int totalCount = memories.stream().mapToInt(m -> m.getMessageCount()).sum();
    return new AiMemoryResponse(/* map fields: */ null, summary, new java.util.ArrayList<>(facts), totalCount /* , updatedAt */);
```
Map the constructor/builder to `AiMemoryResponse`'s real fields (from Step 1). If `AiMemoryResponse` carries a `conversationId`, pass `null` (aggregate has none) or drop it per the DTO. Keep the return type a single `AiMemoryResponse`.

> **Cross-platform note (P3/P4):** web `apps/web` and Flutter `apps/client` `AiMemoryScreen`/AI-context page consume this endpoint. Changing it from a list to a single object is a **client-visible contract change** — flag it for the P3/P4 UI plans (the web/mobile fetchers must expect one object, not an array). This plan does not touch the clients, but the change must be mirrored there per `.claude/rules/sync.md`.

- [ ] **Step 5: Spotless + test + commit**

```bash
cd apps/server/chat-service
mvn -q spotless:apply
mvn -q -Dtest=AiMemoryControllerTest test
git add apps/server/chat-service/src/main/java/com/platform/chatservice/controller/AiMemoryController.java apps/server/chat-service/src/test/java/com/platform/chatservice/controller/AiMemoryControllerTest.java
git commit -m "feat(chat): /api/ai/memories returns one per-user aggregate (global memory)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full regression + docs note

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-role-aware-ai-context-design.md` (append a short "P2b as-built" note)

- [ ] **Step 1: Full test both services**

```bash
pnpm --filter @platform/ai-service test
cd apps/server/chat-service && mvn -q test
```
Expected: both green (no regressions).

- [ ] **Step 2: Record the as-built simplification vs spec §6**

Append to the spec a short note under §6: "**As-built (P2b):** No Mongo migration was needed. Retrieval/dedup/list switched to a `{userId}` Qdrant filter (global recall immediately). `ai_memories` docs stay per-conversation; `/api/ai/memories` aggregates them into one deduped per-user view. `conversationId` retained in vector payload for provenance + conversation-delete."

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-13-role-aware-ai-context-design.md
git commit -m "docs(ai-context): record P2b as-built (no vector migration; endpoint aggregation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (P2 memory portion):**
- §6 `MemoryVectorService.retrieve/nearest/listFacts` filter by `userId` only; `conversationId` stays in payload → Task 1. ✅
- §6 `MemoryService.addFacts/retrieveRelevantFacts` drop `conversationId` scoping; dedup per-user → Task 2. ✅
- §6 `remember_fact` + `FactExtractorService` keep working, scope now per-user → Task 3 (signatures unchanged; only copy). ✅
- §6/§8 `ai_memory` canonical list per-user + `/api/ai/memories` per-user → Task 4 (endpoint aggregation; deliberately no schema migration — documented in Task 5). ✅
- §6 "one-time migration OR self-heal on next write" → chose self-heal + endpoint dedup (no migration script). Documented. ✅
- **Deferred:** §9 UI (P3/P4) — Task 4 flags the list→object contract change for those plans. ✅

**Placeholder scan:** No TBD/TODO. Full code in each code step. The "adapt to the real controller/DTO/principal" notes in Task 4 are concrete verification instructions (read Step 1 first), guarded with explicit fallbacks — not placeholders.

**Type consistency:** `retrieve(userId, queryVector, topN)`, `nearest(userId, vector)`, `listFacts(userId)` — three-way consistent across Task 1 (impl), Task 2 (callers), and Task 2 spec. `addFacts` keeps its 6-arg shape everywhere (Tasks 2–3). Endpoint returns a single `AiMemoryResponse` in both Task 4 impl and test.

## Execution Handoff

See end of conversation for execution-mode choice.
