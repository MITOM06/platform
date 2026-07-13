# AI Context — P2a: `ai.requests` Payload Enrichment + Org-Context Prompt Assembly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread the caller's `role` (name), `perms`, and `departmentIds` from the JWT all the way into the `ai.requests` job, and have ai-service prepend a bounded, role-filtered **"About the user & their organization"** block (personal profile + company/department context entries) to every turn — without busting the cached persona prefix.

**Architecture:** chat-service already parses `role`/`perms`/`depts` from the JWT into `UserPrincipal` (REST path) — this plan (a) makes the **STOMP** path carry the same `UserPrincipal` (today it sets a bare `UsernamePasswordAuthenticationToken`), (b) widens the `AiRequestPayload` DTO + `AiRedisPublisher` + both call sites to forward those claims. ai-service consumes them, and a new `AiContextReaderService` reads the P1 collections (`ai_user_context`, `ai_context_entries`) + resolves department **names** from the shared `platform` DB (cached per-user, ~60 s TTL). `ContextBuilderService` composes a length-capped, injection-safe org block placed in the **volatile** grounding context (after the cached persona), gated by the caller's `perms` + `departmentIds`.

**Tech Stack:** NestJS 10 + `@nestjs/mongoose` (ai-service, port 3002); Spring Boot 3 + Lombok + Maven (chat-service, port 8080); shared schemas from `@platform/database`; Jest; JUnit; pnpm; MongoDB `platform` @ 27018.

## Global Constraints

- Package manager: **pnpm** (never npm/yarn) for JS/TS; **Maven** for Java.
- ai-service max **300 lines/file**; chat-service/NestJS max **500 lines/file** — split if exceeded.
- Constructor injection only (NestJS `@Injectable()` DI / Spring `@RequiredArgsConstructor`); never `new` a service; never `process.env.X` inside a service (use `ConfigService`).
- **Backward-compatible & additive:** a payload missing `role`/`perms`/`departmentIds` must behave exactly as today (treat as Member / no perms / no departments). Never break the existing `ai.requests` contract.
- Jakarta EE only in chat-service (`jakarta.*`, never `javax.*`). User identity always from `SecurityContextHolder` / JWT, never request body.
- After **every** Java edit run `mvn spotless:apply` (google-java-format is bound to test-compile and will fail the build otherwise — see the chat-service spotless note).
- `Capability` is the single source of truth in `@platform/database`; never duplicate the enum.
- Trusted vs untrusted text: company/department/user-profile text is admin/superior-authored → **trusted**; do NOT wrap it in the untrusted fence. (Learned facts keep their existing `sanitizeUntrusted` treatment — that lives in P2b, not here.)

---

### Task 1: Extend ai-service request/context types (additive)

**Files:**
- Modify: `apps/server/ai-service/src/ai/ai.types.ts`
- Test: `apps/server/ai-service/src/ai/ai-types.spec.ts` (create)

**Interfaces:**
- Produces: `AiRequestPayload` gains optional `role?: string`, `perms?: string[]`, `departmentIds?: string[]`. `RequestContext` gains `role?: string`, `perms: string[]`, `departmentIds: string[]` (non-optional on the internal context — defaulted to `''`/`[]` at construction).

- [ ] **Step 1: Write the failing test**

Create `apps/server/ai-service/src/ai/ai-types.spec.ts`:
```ts
import { AiRequestPayload, RequestContext } from './ai.types';

describe('AI context payload/context types', () => {
  it('AiRequestPayload accepts optional RBAC claims and remains valid without them', () => {
    const legacy: AiRequestPayload = {
      conversationId: 'c1',
      userId: 'u1',
      displayName: 'Khang',
      content: 'hi',
      history: [],
    };
    const enriched: AiRequestPayload = {
      ...legacy,
      role: 'Manager',
      perms: ['VIEW_INTERNAL_CONTEXT'],
      departmentIds: ['d1'],
    };
    expect(legacy.perms).toBeUndefined();
    expect(enriched.perms).toEqual(['VIEW_INTERNAL_CONTEXT']);
    expect(enriched.departmentIds).toEqual(['d1']);
  });

  it('RequestContext carries resolved (non-optional) perms + departmentIds', () => {
    const ctx = { perms: [] as string[], departmentIds: [] as string[] } as Partial<RequestContext>;
    expect(ctx.perms).toEqual([]);
    expect(ctx.departmentIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @platform/ai-service test -- ai-types`
Expected: FAIL — TS2353/TS2339 "`perms` does not exist on type `AiRequestPayload`" (and on `RequestContext`).

- [ ] **Step 3: Add the fields**

In `ai.types.ts`, extend `AiRequestPayload` (after `departmentId?: string;`):
```ts
  /** Role NAME from the caller's JWT (e.g. 'Owner'|'Admin'|'Manager'|'Member'); absent for legacy tokens. */
  role?: string;
  /** Enabled capability keys from the JWT `perms` claim; absent ⇒ treat as no capabilities. */
  perms?: string[];
  /** Department ids the caller belongs to (JWT `depts` claim); absent ⇒ no departments. */
  departmentIds?: string[];
```
In `RequestContext`, add (after `departmentId?: string;`):
```ts
  /** Caller role NAME for the org-context block (may be undefined for legacy tokens). */
  role?: string;
  /** Resolved caller capabilities — gates which context entries are injected. */
  perms: string[];
  /** Resolved caller department ids — gates department-scoped context entries. */
  departmentIds: string[];
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @platform/ai-service test -- ai-types`
Expected: PASS. (If other files fail to compile because `RequestContext` literals now require `perms`/`departmentIds`, that is expected — Task 5 supplies them; do NOT fix call sites here, just confirm the ai-types spec passes. If the build blocks the test, temporarily leave `perms`/`departmentIds` optional with `?` — but prefer non-optional and let Task 5 satisfy it. Since the only `RequestContext` literal is in `ai.service.ts` processRequest, add `perms: payload.perms ?? [], departmentIds: payload.departmentIds ?? []` there now to keep the tree compiling.)

> Compile-keeping edit (do it in this task): in `apps/server/ai-service/src/ai/ai.service.ts`, in the `const ctx: RequestContext = { ... }` literal, add `role: payload.role,` `perms: payload.perms ?? [],` and `departmentIds: payload.departmentIds ?? [],`. Task 5 consumes them.

- [ ] **Step 5: Commit**

```bash
pnpm --filter @platform/ai-service build
git add apps/server/ai-service/src/ai/ai.types.ts apps/server/ai-service/src/ai/ai-types.spec.ts apps/server/ai-service/src/ai/ai.service.ts
git commit -m "feat(ai): thread role/perms/departmentIds through request+context types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: STOMP path carries the full `UserPrincipal`

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/security/AuthChannelInterceptor.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/security/AuthChannelInterceptorTest.java` (create if absent; otherwise extend)

**Interfaces:**
- Produces: on STOMP `CONNECT`, `accessor.setUser(...)` is a `UserPrincipal(userId, role, perms, depts)` (was `UsernamePasswordAuthenticationToken(userId, null, List.of())`). `principal.getName()` still returns `userId` (unchanged for existing callers).

- [ ] **Step 1: Read the interceptor to confirm the CONNECT branch**

Read `AuthChannelInterceptor.java` around line 57. Confirm it parses the token via `JwtUtil` and currently sets `new UsernamePasswordAuthenticationToken(userId, null, List.of())`. `JwtUtil` already exposes `extractRole`, `extractPerms`, `extractDepts`.

- [ ] **Step 2: Write the failing test**

Create/extend `AuthChannelInterceptorTest.java`. Mirror the existing interceptor test setup if one exists; otherwise:
```java
package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

@ExtendWith(MockitoExtension.class)
class AuthChannelInterceptorTest {

  @Mock JwtUtil jwtUtil;

  private Message<byte[]> connectMessage(String token) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.addNativeHeader("Authorization", "Bearer " + token);
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }

  @Test
  void connectSetsUserPrincipalWithRbacClaims() {
    when(jwtUtil.isValid("tok")).thenReturn(true);
    when(jwtUtil.extractUserId("tok")).thenReturn("u1");
    when(jwtUtil.extractRole("tok")).thenReturn("Manager");
    when(jwtUtil.extractPerms("tok")).thenReturn(List.of("VIEW_INTERNAL_CONTEXT"));
    when(jwtUtil.extractDepts("tok")).thenReturn(List.of("d1"));

    AuthChannelInterceptor interceptor = new AuthChannelInterceptor(jwtUtil);
    Message<?> out = interceptor.preSend(connectMessage("tok"), null);

    StompHeaderAccessor acc = StompHeaderAccessor.wrap(out);
    assertThat(acc.getUser()).isInstanceOf(UserPrincipal.class);
    UserPrincipal p = (UserPrincipal) acc.getUser();
    assertThat(p.getUserId()).isEqualTo("u1");
    assertThat(p.getRole()).isEqualTo("Manager");
    assertThat(p.getPerms()).containsExactly("VIEW_INTERNAL_CONTEXT");
    assertThat(p.getDepts()).containsExactly("d1");
  }
}
```

> If the interceptor's constructor or `preSend` signature differs from the above (e.g. it takes more collaborators), read the class and adapt the construction/invocation to match — keep the assertions.

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/server/chat-service && mvn -q -Dtest=AuthChannelInterceptorTest test`
Expected: FAIL — `getUser()` is a `UsernamePasswordAuthenticationToken`, not `UserPrincipal`.

- [ ] **Step 4: Implement**

In `AuthChannelInterceptor.java`, replace the CONNECT user assignment:
```java
      accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
```
with:
```java
      accessor.setUser(
          new UserPrincipal(
              userId,
              jwtUtil.extractRole(token),
              jwtUtil.extractPerms(token),
              jwtUtil.extractDepts(token)));
```
Remove the now-unused `UsernamePasswordAuthenticationToken` import if nothing else uses it.

- [ ] **Step 5: Run + spotless + full module test**

```bash
cd apps/server/chat-service
mvn -q spotless:apply
mvn -q -Dtest=AuthChannelInterceptorTest test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/security/AuthChannelInterceptor.java apps/server/chat-service/src/test/java/com/platform/chatservice/security/AuthChannelInterceptorTest.java
git commit -m "feat(chat): STOMP principal carries role/perms/depts (UserPrincipal on CONNECT)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Widen `AiRequestPayload` DTO + `AiRedisPublisher` + both call sites

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/AiRequestPayload.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ChatController.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/AiRedisPublisherTest.java`

**Interfaces:**
- Consumes: `UserPrincipal` (from Task 2 on STOMP; already present on REST).
- Produces: `AiRequestPayload` record adds `String role, List<String> perms, List<String> departmentIds` (appended after `departmentId`). `AiRedisPublisher.publishAiRequest(...)` adds `String role, List<String> perms, List<String> departmentIds` params (appended after `history`).

- [ ] **Step 1: Update the publisher test first (red)**

Read `AiRedisPublisherTest.java`. Update the existing `publishAiRequest(...)` invocation to pass the 3 new args (e.g. `"Manager", List.of("VIEW_INTERNAL_CONTEXT"), List.of("d1")`) and assert the captured `AiRequestPayload` exposes them:
```java
    // after capturing the sent payload:
    assertThat(sent.role()).isEqualTo("Manager");
    assertThat(sent.perms()).containsExactly("VIEW_INTERNAL_CONTEXT");
    assertThat(sent.departmentIds()).containsExactly("d1");
```
Keep the existing traceparent/exchange assertions.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/server/chat-service && mvn -q -Dtest=AiRedisPublisherTest test`
Expected: FAIL — method signature mismatch / `role()` not a member.

- [ ] **Step 3: Widen the DTO**

`AiRequestPayload.java`:
```java
public record AiRequestPayload(
    String conversationId,
    String userId,
    String displayName,
    String content,
    List<AiHistoryEntry> history,
    /** Owning department id of the conversation, or null for personal chats (P6). */
    String departmentId,
    /** Caller role NAME from the JWT (P2a); null for legacy tokens. */
    String role,
    /** Caller capability keys from the JWT `perms` claim (P2a). */
    List<String> perms,
    /** Caller department ids from the JWT `depts` claim (P2a). */
    List<String> departmentIds) {}
```

- [ ] **Step 4: Widen the publisher**

`AiRedisPublisher.publishAiRequest` — add params and pass through (null-safe the lists):
```java
  public void publishAiRequest(
      String conversationId,
      String userId,
      String displayName,
      String content,
      List<AiHistoryEntry> history,
      String role,
      List<String> perms,
      List<String> departmentIds) {
    String departmentId =
        conversationRepository.findById(conversationId).map(c -> c.getDepartmentId()).orElse(null);
    AiRequestPayload payload =
        new AiRequestPayload(
            conversationId,
            userId,
            displayName,
            content,
            history,
            departmentId,
            role,
            perms == null ? java.util.List.of() : perms,
            departmentIds == null ? java.util.List.of() : departmentIds);
    // ... unchanged span + convertAndSend block ...
```

- [ ] **Step 5: Update both call sites to pass the principal's claims**

`ChatController.send` (STOMP): the `Principal principal` is now a `UserPrincipal` (Task 2). Extract claims safely:
```java
      final String uid = principal.getName();
      final String role = principal instanceof UserPrincipal up ? up.getRole() : null;
      final java.util.List<String> perms =
          principal instanceof UserPrincipal up ? up.getPerms() : java.util.List.of();
      final java.util.List<String> depts =
          principal instanceof UserPrincipal up ? up.getDepts() : java.util.List.of();
      // ...
              aiRedisPublisher.publishAiRequest(convId, uid, displayName, stripped, history, role, perms, depts);
```
(Add `import com.platform.chatservice.security.UserPrincipal;` if missing.)

`MessageController` (REST): it already resolves `UserPrincipal principal` (see line ~240 `authentication instanceof UserPrincipal`). At the publish call (~line 70), pass `principal.getRole(), principal.getPerms(), principal.getDepts()`. If only the `uid` string is in scope there, obtain the `UserPrincipal` from the `Authentication` the same way the existing `currentUserId(...)` helper does, then pass its claims.

- [ ] **Step 6: Compile + spotless + tests**

```bash
cd apps/server/chat-service
mvn -q spotless:apply
mvn -q -Dtest=AiRedisPublisherTest test
mvn -q -Dtest='ChatControllerTest,MessageControllerTest' test  # if these exist; otherwise skip
mvn -q test-compile
```
Expected: PASS / clean compile. Fix any other caller of `publishAiRequest` the compiler flags (pass `null, List.of(), List.of()` only if a caller genuinely has no principal — there should be none besides the two controllers).

- [ ] **Step 7: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/dto/AiRequestPayload.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ChatController.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/service/AiRedisPublisherTest.java
git commit -m "feat(chat): forward role/perms/departmentIds into ai.requests payload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `AiContextReaderService` — read P1 collections + dept names (cached)

**Files:**
- Create: `apps/server/ai-service/src/ai-context/ai-context-reader.service.ts`
- Create: `apps/server/ai-service/src/ai-context/ai-context.module.ts`
- Create: `apps/server/ai-service/src/ai-context/ai-context-reader.service.spec.ts`
- Modify: `apps/server/ai-service/src/ai/ai.module.ts` (import `AiContextModule`)

**Interfaces:**
- Consumes: `AiUserContext`, `AiUserContextSchema`, `AiContextEntry`, `AiContextEntrySchema`, `Department`, `DepartmentSchema`, `Capability` from `@platform/database`; `ConfigService`.
- Produces `AiContextReaderService`:
  - `getUserOrgContext(input: { userId: string; perms: string[]; departmentIds: string[]; role?: string }): Promise<OrgContext>` where
    `OrgContext = { role?: string; departmentNames: string[]; profile: { jobTitle: string; projects: string[]; style: string; preferences: string } | null; companyEntries: {label:string;text:string}[]; departmentEntries: {label:string;text:string}[] }`.
  - Visibility gate identical to P1: an entry is included iff `requiredCapability == null || perms.includes(requiredCapability)`. Department entries only for `scopeId ∈ departmentIds`.
  - Per-`userId` in-memory cache with TTL from `config.aiContext.cacheTtlMs` (default 60000). Fail-soft: any read error → return an empty `OrgContext` (never throw).

- [ ] **Step 1: Write the failing test**

`ai-context-reader.service.spec.ts`:
```ts
import { AiContextReaderService } from './ai-context-reader.service';
import { Capability } from '@platform/database';

function model(docs: any) {
  return { find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve(docs) }) }) }) };
}
function findOneModel(doc: any) {
  return { findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(doc) }) }) };
}
const cfg = { get: (k: string) => (k === 'config.aiContext.cacheTtlMs' ? 60000 : undefined) } as any;

describe('AiContextReaderService', () => {
  it('filters entries by requiredCapability and resolves department names', async () => {
    const userCtx = findOneModel({ jobTitle: 'Dev', projects: ['PON'], style: 'brief', preferences: '' });
    const entry = {
      find: jest.fn().mockImplementation((f: any) =>
        f.scope === 'company'
          ? { sort: () => ({ lean: () => ({ exec: () => Promise.resolve([
              { label: 'Pub', text: 'public', requiredCapability: null },
              { label: 'Secret', text: 'secret', requiredCapability: Capability.VIEW_CONFIDENTIAL_CONTEXT },
            ]) }) }) }
          : { sort: () => ({ lean: () => ({ exec: () => Promise.resolve([
              { label: 'DeptNote', text: 'dept', requiredCapability: null, scopeId: 'd1' },
            ]) }) }) },
      ),
    };
    const dept = model([{ _id: 'd1', name: 'Engineering' }]);
    const svc = new AiContextReaderService(userCtx as any, entry as any, dept as any, cfg);

    const res = await svc.getUserOrgContext({ userId: 'u1', perms: [Capability.VIEW_INTERNAL_CONTEXT], departmentIds: ['d1'], role: 'Manager' });
    expect(res.companyEntries.map((e) => e.text)).toEqual(['public']); // secret filtered out
    expect(res.departmentEntries.map((e) => e.text)).toEqual(['dept']);
    expect(res.departmentNames).toEqual(['Engineering']);
    expect(res.profile?.jobTitle).toBe('Dev');
    expect(res.role).toBe('Manager');
  });

  it('returns an empty context on read error (fail-soft)', async () => {
    const boom = { findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) };
    const entry = { find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) }) };
    const dept = { find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.reject(new Error('db down')) }) }) }) };
    const svc = new AiContextReaderService(boom as any, entry as any, dept as any, cfg);
    const res = await svc.getUserOrgContext({ userId: 'u2', perms: [], departmentIds: [] });
    expect(res.companyEntries).toEqual([]);
    expect(res.profile).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @platform/ai-service test -- ai-context-reader`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

`ai-context-reader.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  AiContextEntry,
  AiContextEntryDocument,
  AiUserContext,
  AiUserContextDocument,
  Capability,
  Department,
  DepartmentDocument,
} from '@platform/database';

export interface OrgEntry {
  label: string;
  text: string;
}
export interface OrgProfile {
  jobTitle: string;
  projects: string[];
  style: string;
  preferences: string;
}
export interface OrgContext {
  role?: string;
  departmentNames: string[];
  profile: OrgProfile | null;
  companyEntries: OrgEntry[];
  departmentEntries: OrgEntry[];
}

const EMPTY: OrgContext = {
  departmentNames: [],
  profile: null,
  companyEntries: [],
  departmentEntries: [],
};

interface CacheSlot {
  at: number;
  value: OrgContext;
}

@Injectable()
export class AiContextReaderService {
  private readonly logger = new Logger(AiContextReaderService.name);
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheSlot>();

  constructor(
    @InjectModel(AiUserContext.name)
    private readonly userCtxModel: Model<AiUserContextDocument>,
    @InjectModel(AiContextEntry.name)
    private readonly entryModel: Model<AiContextEntryDocument>,
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
    private readonly config: ConfigService,
  ) {
    this.ttlMs = this.config.get<number>('config.aiContext.cacheTtlMs') ?? 60000;
  }

  async getUserOrgContext(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): Promise<OrgContext> {
    const key = this.cacheKey(input);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const value = await this.load(input);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private cacheKey(input: { userId: string; perms: string[]; departmentIds: string[]; role?: string }): string {
    return `${input.userId}|${input.role ?? ''}|${[...input.perms].sort().join(',')}|${[...input.departmentIds].sort().join(',')}`;
  }

  private gate(perms: string[], cap: Capability | null | undefined): boolean {
    return cap == null || perms.includes(cap);
  }

  private async load(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): Promise<OrgContext> {
    try {
      const [profileDoc, companyDocs, deptDocs, deptNameDocs] = await Promise.all([
        this.userCtxModel.findOne({ userId: input.userId }).lean().exec(),
        this.entryModel.find({ scope: 'company' }).sort({ updatedAt: -1 }).lean().exec(),
        input.departmentIds.length
          ? this.entryModel
              .find({ scope: 'department', scopeId: { $in: input.departmentIds } })
              .sort({ updatedAt: -1 })
              .lean()
              .exec()
          : Promise.resolve([] as AiContextEntry[]),
        input.departmentIds.length
          ? this.deptModel.find({ _id: { $in: input.departmentIds } }).lean().exec()
          : Promise.resolve([] as Department[]),
      ]);

      const toEntry = (e: any): OrgEntry => ({ label: String(e.label ?? ''), text: String(e.text ?? '') });
      const p = profileDoc as any;
      return {
        role: input.role,
        departmentNames: (deptNameDocs as any[]).map((d) => String(d.name ?? '')).filter(Boolean),
        profile: p
          ? {
              jobTitle: String(p.jobTitle ?? ''),
              projects: Array.isArray(p.projects) ? p.projects.map(String) : [],
              style: String(p.style ?? ''),
              preferences: String(p.preferences ?? ''),
            }
          : null,
        companyEntries: (companyDocs as any[]).filter((e) => this.gate(input.perms, e.requiredCapability)).map(toEntry),
        departmentEntries: (deptDocs as any[]).filter((e) => this.gate(input.perms, e.requiredCapability)).map(toEntry),
      };
    } catch (err) {
      this.logger.warn(`Org-context read failed for ${input.userId}: ${(err as Error).message}`);
      return EMPTY;
    }
  }
}
```

- [ ] **Step 4: Implement the module**

`ai-context.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiContextEntry,
  AiContextEntrySchema,
  AiUserContext,
  AiUserContextSchema,
  Department,
  DepartmentSchema,
} from '@platform/database';
import { AiContextReaderService } from './ai-context-reader.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUserContext.name, schema: AiUserContextSchema },
      { name: AiContextEntry.name, schema: AiContextEntrySchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  providers: [AiContextReaderService],
  exports: [AiContextReaderService],
})
export class AiContextModule {}
```

> `DepartmentSchema` must be exported from `@platform/database`. Verify with `grep -n "department.schema" packages/database/src/index.ts` — it is (`export * from './mongo/department.schema'`). If `Department`'s Mongoose model name is already registered by another ai-service module, that is fine — Nest de-dupes model providers per connection.

- [ ] **Step 5: Wire the module + add the config default**

In `apps/server/ai-service/src/ai/ai.module.ts`, add `AiContextModule` to `imports`. In `apps/server/ai-service/src/config/configuration.ts`, add under the config object: `aiContext: { cacheTtlMs: Number(process.env.AI_CONTEXT_CACHE_TTL_MS ?? 60000) }` (follow the file's existing style — it is the ONE place `process.env` is allowed).

- [ ] **Step 6: Run + build + commit**

```bash
pnpm --filter @platform/ai-service test -- ai-context-reader
pnpm --filter @platform/ai-service build
git add apps/server/ai-service/src/ai-context/ apps/server/ai-service/src/ai/ai.module.ts apps/server/ai-service/src/config/configuration.ts
git commit -m "feat(ai): AiContextReaderService — read per-user + company/dept context (cached, fail-soft)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Assemble the org block into the volatile context

**Files:**
- Create: `apps/server/ai-service/src/ai/org-context-block.ts` (pure formatter + length cap)
- Create: `apps/server/ai-service/src/ai/org-context-block.spec.ts`
- Modify: `apps/server/ai-service/src/ai/context-builder.service.ts` (inject reader, prepend block)
- Modify: `apps/server/ai-service/src/ai/ai.service.ts` (pass `role/perms/departmentIds` into `buildVolatileContext`)

**Interfaces:**
- Consumes: `OrgContext` (Task 4).
- Produces: `formatOrgContextBlock(ctx: OrgContext, maxChars: number): string` — returns `''` when there is nothing to say; otherwise a single `## About the user & their organization` block, hard-capped at `maxChars` (truncate with an ellipsis marker). `ContextBuilderService.buildVolatileContext(conversationId, userId, queryVector, queryText, departmentId, org?)` gains a trailing optional `org?: { perms: string[]; departmentIds: string[]; role?: string }` argument.

- [ ] **Step 1: Write the failing formatter test**

`org-context-block.spec.ts`:
```ts
import { formatOrgContextBlock } from './org-context-block';

const base = {
  role: 'Manager',
  departmentNames: ['Engineering'],
  profile: { jobTitle: 'Backend Dev', projects: ['PON'], style: 'concise', preferences: 'no emoji' },
  companyEntries: [{ label: 'Mission', text: 'Build the best assistant.' }],
  departmentEntries: [{ label: 'Sprint', text: 'Ship P2 this week.' }],
};

describe('formatOrgContextBlock', () => {
  it('renders identity, profile, and role-filtered entries', () => {
    const out = formatOrgContextBlock(base, 4000);
    expect(out).toContain('## About the user & their organization');
    expect(out).toContain('Manager');
    expect(out).toContain('Engineering');
    expect(out).toContain('Backend Dev');
    expect(out).toContain('PON');
    expect(out).toContain('Mission');
    expect(out).toContain('Ship P2 this week.');
  });

  it('returns empty string when there is nothing to say', () => {
    expect(formatOrgContextBlock({ departmentNames: [], profile: null, companyEntries: [], departmentEntries: [] }, 4000)).toBe('');
  });

  it('caps the block length', () => {
    const huge = { ...base, companyEntries: [{ label: 'X', text: 'y'.repeat(10000) }] };
    const out = formatOrgContextBlock(huge, 500);
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @platform/ai-service test -- org-context-block`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the formatter**

`org-context-block.ts`:
```ts
import { OrgContext } from '../ai-context/ai-context-reader.service';

/**
 * Compose the trusted "About the user & their organization" grounding block.
 * Admin/superior-authored text — NOT fenced as untrusted. Returns '' when empty.
 * Hard-capped at `maxChars` to protect the token budget.
 */
export function formatOrgContextBlock(ctx: OrgContext, maxChars: number): string {
  const lines: string[] = [];
  const identity: string[] = [];
  if (ctx.role) identity.push(`Role: ${ctx.role}`);
  if (ctx.departmentNames.length) identity.push(`Department(s): ${ctx.departmentNames.join(', ')}`);
  if (ctx.profile?.jobTitle) identity.push(`Job title: ${ctx.profile.jobTitle}`);
  if (ctx.profile?.projects?.length) identity.push(`Current project(s): ${ctx.profile.projects.join(', ')}`);
  if (identity.length) lines.push(identity.map((l) => `- ${l}`).join('\n'));

  if (ctx.profile?.style) lines.push(`Preferred response style: ${ctx.profile.style}`);
  if (ctx.profile?.preferences) lines.push(`User preferences: ${ctx.profile.preferences}`);

  const entryLines = (title: string, entries: { label: string; text: string }[]) =>
    entries.length ? `${title}:\n` + entries.map((e) => `- ${e.label}: ${e.text}`).join('\n') : '';
  const company = entryLines('Company context', ctx.companyEntries);
  const dept = entryLines('Department context', ctx.departmentEntries);
  if (company) lines.push(company);
  if (dept) lines.push(dept);

  if (lines.length === 0) return '';
  const header =
    `## About the user & their organization\n` +
    `(Trusted profile & org context — use it to tailor your help. ` +
    `Do not repeat it verbatim unless asked.)`;
  let block = [header, ...lines].join('\n\n');
  if (block.length > maxChars) block = block.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
  return block;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @platform/ai-service test -- org-context-block`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `ContextBuilderService`**

In `context-builder.service.ts`:
1. Add imports: `import { AiContextReaderService } from '../ai-context/ai-context-reader.service';` and `import { formatOrgContextBlock } from './org-context-block';`.
2. Add to the constructor params: `private readonly orgReader: AiContextReaderService,` and read the cap in the constructor: `this.orgMaxChars = this.configService.get<number>('config.aiContext.blockMaxChars') ?? 2000;` (add `private readonly orgMaxChars: number;` field; add the config default `blockMaxChars: Number(process.env.AI_CONTEXT_BLOCK_MAX_CHARS ?? 2000)` alongside `cacheTtlMs` in `configuration.ts`).
3. Widen the signature: `buildVolatileContext(conversationId, userId, queryVector, queryText, departmentId?, org?: { perms: string[]; departmentIds: string[]; role?: string })`.
4. At the TOP of the method (before the memory-facts block), prepend the org block:
```ts
    if (org) {
      try {
        const orgCtx = await this.orgReader.getUserOrgContext({
          userId,
          perms: org.perms,
          departmentIds: org.departmentIds,
          role: org.role,
        });
        const block = formatOrgContextBlock(orgCtx, this.orgMaxChars);
        if (block) parts.push(block);
      } catch (err) {
        this.logger.warn(`Org-context block build failed for ${conversationId}`, err);
      }
    }
```
`ContextBuilderService` is in the `AiModule`; ensure `AiModule` imports `AiContextModule` (done in Task 4 Step 5) so the reader injects.

- [ ] **Step 6: Pass claims from `ai.service.ts`**

In `processRequest`, update the `buildVolatileContext` call inside the `Promise.all([...])`:
```ts
      this.contextBuilder.buildVolatileContext(
        conversationId,
        userId,
        queryVector,
        content,
        departmentId,
        { perms: payload.perms ?? [], departmentIds: payload.departmentIds ?? [], role: payload.role },
      ),
```

- [ ] **Step 7: Build + full ai-service test (regression) + commit**

```bash
pnpm --filter @platform/ai-service build
pnpm --filter @platform/ai-service test
git add apps/server/ai-service/src/ai/org-context-block.ts apps/server/ai-service/src/ai/org-context-block.spec.ts apps/server/ai-service/src/ai/context-builder.service.ts apps/server/ai-service/src/ai/ai.service.ts apps/server/ai-service/src/config/configuration.ts
git commit -m "feat(ai): inject role-filtered org-context block into volatile grounding

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: full suite green (the org block is additive; existing context-builder tests still pass because `org` is optional and defaults to skipped).

---

## Self-Review

**Spec coverage (P2 portion — payload + prompt):**
- §5 chat-service adds `roleId`/`perms`/`departmentIds` to `ai.requests` → Tasks 2–3 (we forward role NAME + perms + departmentIds; role name is more directly useful than roleId and is what the JWT carries). ✅
- §5 ai-service reads the two context collections directly from shared DB, cached ~60 s → Task 4. ✅
- §7 prompt assembly: fetch company (perms-filtered) + department (membership+perms) + `ai_user_context` + derived department names; length-capped; injected into volatile context; fail-soft → Tasks 4–5. ✅
- §10 length cap + degrade-on-error → Task 4 (fail-soft empty) + Task 5 (`maxChars`). ✅
- Backward-compat (missing claims ⇒ Member/no perms) → Task 1 defaults + Task 3 null-safe lists + Task 5 `?? []`. ✅
- **Deferred to P2b (correctly out of scope here):** §6 learned-facts global re-scope, §8 `/api/ai/memories` per-user aggregate. Noted, not gaps.
- Role NAME vs roleId: deliberate deviation — the JWT/`UserPrincipal` carries the role **name**, so we forward that (no extra Role lookup needed for the prompt). Documented.

**Placeholder scan:** No TBD/TODO. Every code step has full code. The two "read the class / adapt if signature differs" notes (Task 2 test, Task 3 MessageController) are concrete verification instructions with a stated fallback, not placeholders.

**Type consistency:** `OrgContext`/`OrgEntry`/`OrgProfile` defined in Task 4 and consumed in Task 5. `buildVolatileContext`'s new `org?: { perms; departmentIds; role? }` shape matches the `ai.service.ts` call in Task 5 Step 6 and the reader input in Task 4. `perms`/`departmentIds` naming consistent across Java DTO, publisher, ai.types, reader, and formatter.

## Execution Handoff

See end of conversation for execution-mode choice.
