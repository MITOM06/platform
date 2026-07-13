# AI Context — P3: Web UI (Next.js) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web "AI Memory" page with a role-aware **"AI Context"** page (identity/org read-only, self-editable response style, learned-facts list, role-filtered company/department context) and add the admin/manager editors (per-member hard fields + company/department context entries) — all wired to the P1 auth-service `/ai-context/*` API and the now-aggregated `/api/ai/memories` endpoint.

**Architecture:** Structured context (profile + entries) is read/written against **auth-service** (`authApi`, port 3001, `/ai-context/*`). Learned facts stay on **chat-service** (`chatApi`, `/api/ai/memories`) which now returns ONE aggregate object (P2b). The current user's role/perms/departments come from the existing `useCapabilities()` hook (`GET /me/capabilities`). Admin editors extend the existing `MembersPanel` (per-row modal) and `AdminShell` section registry. One small backend enrichment (Task 1) adds `identity {role, departmentNames}` to `GET /ai-context/me` so both web (P3) and Flutter (P4) can render the identity section without exposing the department list to members.

**Tech Stack:** Next.js App Router, TanStack Query + axios, Zustand (auth), shadcn/ui, next-intl (7 locales: vi/en/zh/ja/ko/es/fr), Vitest, pnpm. Backend touch: NestJS auth-service + Jest.

## Global Constraints

- pnpm only. Web build/verify: `pnpm --filter @platform/web build` (Next build does typecheck+lint); unit tests `pnpm --filter @platform/web test`; lint `pnpm --filter @platform/web lint`. Backend: `pnpm --filter @platform/auth-service test` / `build`.
- **i18n is mandatory:** no hardcoded UI strings. Every new string added to **all 7** files `apps/web/messages/{vi,en,zh,ja,ko,es,fr}.json`. English is the source; other locales may reuse the English value as a placeholder (build stays green) but add the key to every file. Read strings via `useTranslations('<namespace>')`.
- Max 400 lines/file; extract sub-components when JSX > 5 levels deep. shadcn/ui files under `components/ui/` are never edited.
- **Sync rule (`.claude/rules/sync.md`):** every section built here has a Flutter mirror in P4. Keep section structure + i18n key names parallel so P4 can mirror 1:1.
- **No-raw-system-data rule:** never render raw ids, capability keys, or JSON. Show role/department NAMES, humanized labels, localized tier names.
- Auth-service `/ai-context/*` has no global prefix (routes at root on port 3001) → call via `authApi.get('/ai-context/...')`. Learned facts via `chatApi` (`/api/ai/memories`).
- RBAC on web: read `useCapabilities()` → `{ role, perms, depts }`; gate admin UI with `<RequireCap cap="...">` / `useHasCapability('MANAGE_AI_CONTEXT')`. New caps from P1: `MANAGE_AI_CONTEXT`, `VIEW_INTERNAL_CONTEXT`, `VIEW_CONFIDENTIAL_CONTEXT` — add them to `apps/web/lib/api/admin-types.ts` `CAPABILITIES`/`Capability` union.

---

### Task 1: Backend — enrich `GET /ai-context/me` with `identity {role, departmentNames}`

**Files:**
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.service.ts`
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.controller.ts`
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.service.spec.ts`
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.controller.spec.ts`

**Interfaces:**
- Produces on `AiContextService`: `resolveDepartmentNames(deptIds: string[]): Promise<string[]>` — maps department ids → names via `deptModel`, order-preserving, missing ids dropped, `[]` on empty/error.
- `GET /ai-context/me` response becomes `{ context: AiUserContext; identity: { role: string | null; departmentNames: string[] }; entries: AiContextEntry[] }`. `role` comes from the JWT (`user.role`), department names resolved from `user.depts`.

- [ ] **Step 1: Failing service test**

Append to `ai-context.service.spec.ts` (reuse the `makeService`/`makeModels` harness; extend `dept` mock with `find` returning name docs):
```ts
describe('AiContextService — resolveDepartmentNames', () => {
  it('maps ids to names, preserving order and dropping unknowns', async () => {
    const dept = {
      find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([
        { _id: 'd2', name: 'Sales' },
        { _id: 'd1', name: 'Engineering' },
      ]) }) }),
    };
    const svc = new AiContextService({} as any, {} as any, {} as any, dept as any);
    const names = await svc.resolveDepartmentNames(['d1', 'd2', 'dX']);
    expect(names).toEqual(['Engineering', 'Sales']);
  });

  it('returns [] for empty input without querying', async () => {
    const dept = { find: jest.fn() };
    const svc = new AiContextService({} as any, {} as any, {} as any, dept as any);
    expect(await svc.resolveDepartmentNames([])).toEqual([]);
    expect(dept.find).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @platform/auth-service test -- ai-context.service`
Expected: FAIL — `resolveDepartmentNames` undefined.

- [ ] **Step 3: Implement `resolveDepartmentNames`**

Add to `AiContextService`:
```ts
  async resolveDepartmentNames(deptIds: string[]): Promise<string[]> {
    if (!deptIds || deptIds.length === 0) return [];
    try {
      const docs = await this.deptModel.find({ _id: { $in: deptIds } }).lean().exec();
      const byId = new Map(
        (docs as any[]).map((d) => [String(d._id), String(d.name ?? '')]),
      );
      return deptIds.map((id) => byId.get(String(id))).filter((n): n is string => !!n);
    } catch {
      return [];
    }
  }
```

- [ ] **Step 4: Failing controller test**

In `ai-context.controller.spec.ts`, extend the `svc` mock with `resolveDepartmentNames: jest.fn().mockResolvedValue(['Engineering'])` and update the `GET /me` test:
```ts
  it('GET /me aggregates context + identity + visible entries', async () => {
    const u = { sub: 'u1', perms: ['VIEW_INTERNAL_CONTEXT'], role: 'Manager', depts: ['d1'] } as any;
    const res = await ctrl.getMine(u);
    expect(res.context.style).toBe('s');
    expect(res.entries).toEqual([{ label: 'x' }]);
    expect(res.identity).toEqual({ role: 'Manager', departmentNames: ['Engineering'] });
    expect(svc.resolveDepartmentNames).toHaveBeenCalledWith(['d1']);
  });
```

- [ ] **Step 5: Run → FAIL**, then implement the controller

Run: `pnpm --filter @platform/auth-service test -- ai-context.controller` → FAIL.
Update `getMine` in `ai-context.controller.ts`:
```ts
  @Get('me')
  async getMine(@CurrentUser() user: JwtUser) {
    const depts = this.deptIds(user);
    const [context, entries, departmentNames] = await Promise.all([
      this.service.getUserContext(user.sub),
      this.service.getVisibleEntriesForUser(user.sub, user.perms ?? [], depts),
      this.service.resolveDepartmentNames(depts),
    ]);
    return { context, identity: { role: user.role ?? null, departmentNames }, entries };
  }
```

- [ ] **Step 6: Run → PASS + full auth-service suite + commit**

```bash
pnpm --filter @platform/auth-service test -- ai-context
pnpm --filter @platform/auth-service test
pnpm --filter @platform/auth-service build
git add apps/server/auth-service/src/modules/ai-context/
git commit -m "feat(auth): enrich GET /ai-context/me with identity (role + department names)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: green suite; identity now available for the clients.

---

### Task 2: Web API client + types for AI Context (+ memory contract change)

**Files:**
- Create: `apps/web/lib/api/ai-context.ts`
- Modify: `apps/web/lib/api/ai.ts` (memory: array → single aggregate)
- Modify: `apps/web/lib/api/admin-types.ts` (add the 3 new capabilities)
- Test: `apps/web/lib/api/ai-context.test.ts`

**Interfaces:**
- Produces types: `AiUserContext { userId; jobTitle; projects: string[]; style; preferences; updatedBy }`, `AiContextEntry { _id; scope: 'company'|'department'; scopeId: string|null; label; text; requiredCapability: string|null; createdBy; updatedBy; updatedAt }`, `MyAiContext { context: AiUserContext; identity: { role: string|null; departmentNames: string[] }; entries: AiContextEntry[] }`, `ContextTier = 'public'|'internal'|'confidential'`.
- Produces `aiContextService` (on `authApi`): `getMine()`, `updateMyStyle(body:{style?;preferences?})`, `getUser(userId)`, `updateUserHard(userId, body:{jobTitle?;projects?})`, `listEntries(scope, scopeId?)`, `createEntry(dto)`, `updateEntry(id, dto)`, `deleteEntry(id)`.
- Modifies `aiService.getMyMemories()` return type from `AiMemory[]` → `AiMemory` (single aggregate); `conversationId` may be `null`.

- [ ] **Step 1: Write the failing test**

`apps/web/lib/api/ai-context.test.ts` (Vitest; mock `authApi`):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from './axios';
import { aiContextService, tierToCapability, capabilityToTier } from './ai-context';

vi.mock('./axios', () => ({ authApi: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

describe('aiContextService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getMine GETs /ai-context/me', async () => {
    (authApi.get as any).mockResolvedValue({ data: { context: { style: 's' }, identity: { role: 'Manager', departmentNames: [] }, entries: [] } });
    const res = await aiContextService.getMine();
    expect(authApi.get).toHaveBeenCalledWith('/ai-context/me');
    expect(res.identity.role).toBe('Manager');
  });

  it('updateMyStyle PATCHes /ai-context/me/style', async () => {
    (authApi.patch as any).mockResolvedValue({ data: { style: 'brief' } });
    await aiContextService.updateMyStyle({ style: 'brief' });
    expect(authApi.patch).toHaveBeenCalledWith('/ai-context/me/style', { style: 'brief' });
  });

  it('createEntry maps tier → requiredCapability', () => {
    expect(tierToCapability('public')).toBeNull();
    expect(tierToCapability('internal')).toBe('VIEW_INTERNAL_CONTEXT');
    expect(tierToCapability('confidential')).toBe('VIEW_CONFIDENTIAL_CONTEXT');
    expect(capabilityToTier(null)).toBe('public');
    expect(capabilityToTier('VIEW_CONFIDENTIAL_CONTEXT')).toBe('confidential');
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `pnpm --filter @platform/web test -- ai-context`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the client**

`apps/web/lib/api/ai-context.ts`:
```ts
import { authApi } from './axios';

export interface AiUserContext {
  userId: string;
  jobTitle: string;
  projects: string[];
  style: string;
  preferences: string;
  updatedBy: string;
}
export interface AiContextEntry {
  _id: string;
  scope: 'company' | 'department';
  scopeId: string | null;
  label: string;
  text: string;
  requiredCapability: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt?: string;
}
export interface MyAiContext {
  context: AiUserContext;
  identity: { role: string | null; departmentNames: string[] };
  entries: AiContextEntry[];
}
export type ContextTier = 'public' | 'internal' | 'confidential';

export function tierToCapability(tier: ContextTier): string | null {
  if (tier === 'internal') return 'VIEW_INTERNAL_CONTEXT';
  if (tier === 'confidential') return 'VIEW_CONFIDENTIAL_CONTEXT';
  return null;
}
export function capabilityToTier(cap: string | null): ContextTier {
  if (cap === 'VIEW_CONFIDENTIAL_CONTEXT') return 'confidential';
  if (cap === 'VIEW_INTERNAL_CONTEXT') return 'internal';
  return 'public';
}

export interface UpsertEntryInput {
  scope: 'company' | 'department';
  scopeId?: string | null;
  label: string;
  text: string;
  requiredCapability?: string | null;
}

export const aiContextService = {
  getMine: () => authApi.get<MyAiContext>('/ai-context/me').then((r) => r.data),
  updateMyStyle: (body: { style?: string; preferences?: string }) =>
    authApi.patch<AiUserContext>('/ai-context/me/style', body).then((r) => r.data),
  getUser: (userId: string) =>
    authApi.get<AiUserContext>(`/ai-context/users/${userId}`).then((r) => r.data),
  updateUserHard: (userId: string, body: { jobTitle?: string; projects?: string[] }) =>
    authApi.patch<AiUserContext>(`/ai-context/users/${userId}/hard`, body).then((r) => r.data),
  listEntries: (scope: 'company' | 'department', scopeId?: string) =>
    authApi
      .get<AiContextEntry[]>('/ai-context/entries', { params: { scope, scopeId } })
      .then((r) => r.data),
  createEntry: (dto: UpsertEntryInput) =>
    authApi.post<AiContextEntry>('/ai-context/entries', dto).then((r) => r.data),
  updateEntry: (id: string, dto: UpsertEntryInput) =>
    authApi.patch<AiContextEntry>(`/ai-context/entries/${id}`, dto).then((r) => r.data),
  deleteEntry: (id: string) => authApi.delete(`/ai-context/entries/${id}`).then(() => undefined),
};
```

- [ ] **Step 4: Memory contract change (array → single)**

In `apps/web/lib/api/ai.ts`: change `getMyMemories` to return one `AiMemory`:
```ts
  getMyMemories: () => chatApi.get<AiMemory>('/api/ai/memories').then((r) => r.data),
```
(Keep `AiMemory` type; `conversationId` is now nullable — change to `conversationId: string | null`.) The page (Task 4) consumes the single object.

- [ ] **Step 5: Add the 3 capabilities to the web catalog**

In `apps/web/lib/api/admin-types.ts`, add `'MANAGE_AI_CONTEXT'`, `'VIEW_INTERNAL_CONTEXT'`, `'VIEW_CONFIDENTIAL_CONTEXT'` to the `Capability` union AND the `CAPABILITIES` array (so `useHasCapability` typechecks).

- [ ] **Step 6: Run → PASS + commit**

```bash
pnpm --filter @platform/web test -- ai-context
git add apps/web/lib/api/ai-context.ts apps/web/lib/api/ai-context.test.ts apps/web/lib/api/ai.ts apps/web/lib/api/admin-types.ts
git commit -m "feat(web): ai-context API client + memory aggregate contract + new caps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Rename route `/ai-memory` → `/ai-context` (+ redirect, nav links, i18n namespace)

**Files:**
- Rename: `apps/web/app/(main)/ai-memory/` → `apps/web/app/(main)/ai-context/` (dir + `page.tsx`; rename symbol `AiMemoryPage` → `AiContextPage`)
- Create: `apps/web/app/(main)/ai-memory/page.tsx` (redirect stub)
- Modify: `apps/web/app/(main)/settings/page.tsx` (push target + labels)
- Modify: `apps/web/app/(main)/ai-hub/page.tsx` (push target)
- Modify: `apps/web/lib/help/faq-data.ts` (FAQ keys)
- Modify: all 7 `apps/web/messages/*.json` (namespace `aiMemory` → `aiContext`, stray label keys, FAQ keys)

**Interfaces:** consumes nothing new; produces the `/ai-context` route + a permanent redirect from `/ai-memory`.

- [ ] **Step 1: Move the page + rename symbol**

```bash
git mv apps/web/app/(main)/ai-memory apps/web/app/(main)/ai-context
```
In `apps/web/app/(main)/ai-context/page.tsx`, rename `export default function AiMemoryPage()` → `AiContextPage()`. (Its body is replaced in Task 4; the rename here just keeps the tree compiling.)

- [ ] **Step 2: Add the redirect stub at the old path**

Create `apps/web/app/(main)/ai-memory/page.tsx`:
```tsx
import { redirect } from 'next/navigation';

export default function AiMemoryRedirect() {
  redirect('/ai-context');
}
```

- [ ] **Step 3: Update in-app navigation + FAQ**

- `settings/page.tsx`: `router.push('/ai-memory')` → `router.push('/ai-context')`; labels `t('aiMemory')`/`t('aiMemorySubtitle')` → `t('aiContext')`/`t('aiContextSubtitle')`.
- `ai-hub/page.tsx`: `router.push('/ai-memory')` → `router.push('/ai-context')`.
- `lib/help/faq-data.ts`: rename `faq.q.aiMemory`/`faq.a.aiMemory` keys → `faq.q.aiContext`/`faq.a.aiContext` (and update the referenced message keys).

- [ ] **Step 4: Rename the i18n namespace + labels in all 7 locales**

In each `apps/web/messages/{vi,en,zh,ja,ko,es,fr}.json`:
- Rename the `"aiMemory": { ... }` namespace object → `"aiContext": { ... }`.
- Rename the stray label keys: settings-section `"aiMemory"` → `"aiContext"`, nav `"aiMemory": "Memory"` → `"aiContext": "AI Context"`, add `"aiContextSubtitle"`.
- Rename FAQ keys `faq.q.aiMemory`/`faq.a.aiMemory` → `...aiContext`.
Provide English values in `en.json`; for the other 6, translate or reuse English as a placeholder — but the key MUST exist in all 7. (New section keys are added in Task 4.)

- [ ] **Step 5: Verify build + commit**

```bash
pnpm --filter @platform/web build
git add apps/web/app/'(main)'/ai-context apps/web/app/'(main)'/ai-memory apps/web/app/'(main)'/settings/page.tsx apps/web/app/'(main)'/ai-hub/page.tsx apps/web/lib/help/faq-data.ts apps/web/messages
git commit -m "feat(web): rename /ai-memory route + i18n namespace to ai-context (+ redirect)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: build passes; visiting `/ai-memory` redirects to `/ai-context`.

---

### Task 4: Build the AI Context page (4 sections)

**Files:**
- Rewrite: `apps/web/app/(main)/ai-context/page.tsx` (orchestrator; < 400 lines — extract sections)
- Create: `apps/web/components/ai/IdentitySection.tsx`, `ResponseStyleSection.tsx`, `LearnedFactsSection.tsx`, `CompanyContextSection.tsx`
- Create: `apps/web/lib/hooks/use-ai-context.ts` (TanStack Query hooks)
- Modify: all 7 `messages/*.json` (new `aiContext.*` section keys)
- Test: `apps/web/components/ai/ResponseStyleSection.test.tsx`

**Interfaces:**
- Produces hooks: `useMyAiContext()` (`['ai-context','me']` → `aiContextService.getMine()`), `useUpdateMyStyle()` (mutation → invalidate `['ai-context','me']` + toast), `useMyMemory()` (`['ai-memory']` → `aiService.getMyMemories()` single), `useDeleteMemory()`.
- Sections consume `MyAiContext` + `AiMemory`.

- [ ] **Step 1: Write the hooks**

`apps/web/lib/hooks/use-ai-context.ts` — mirror `use-admin.ts` (useQuery/useMutation + `queryClient.invalidateQueries` + `toast.success/error` with `useTranslations`):
```ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { aiContextService } from '@/lib/api/ai-context';
import { aiService } from '@/lib/api/ai';

export function useMyAiContext() {
  return useQuery({ queryKey: ['ai-context', 'me'], queryFn: () => aiContextService.getMine() });
}
export function useUpdateMyStyle() {
  const qc = useQueryClient();
  const t = useTranslations('aiContext');
  return useMutation({
    mutationFn: (body: { style?: string; preferences?: string }) => aiContextService.updateMyStyle(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-context', 'me'] }); toast.success(t('styleSaved')); },
    onError: () => toast.error(t('saveError')),
  });
}
export function useMyMemory() {
  return useQuery({ queryKey: ['ai-memory'], queryFn: () => aiService.getMyMemories() });
}
export function useDeleteMemory() {
  const qc = useQueryClient();
  const t = useTranslations('aiContext');
  return useMutation({
    mutationFn: (conversationId: string) => aiService.deleteMemory(conversationId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-memory'] }); toast.success(t('memoryDeleted')); },
    onError: () => toast.error(t('deleteError')),
  });
}
```

- [ ] **Step 2: IdentitySection (read-only)**

`components/ai/IdentitySection.tsx` — props `{ identity: {role,departmentNames}, context: AiUserContext }`. Render a shadcn `Card` with rows: Role (`identity.role ?? t('roleUnknown')`), Department(s) (`identity.departmentNames.join(', ')` or `t('noDepartment')`), Job title (`context.jobTitle || t('notSet')`), Current projects (`context.projects` as `Badge`s or `t('notSet')`). All labels via `useTranslations('aiContext')`. Note under the card: `t('identityManagedBySuperior')` (explains these are set by a manager/admin).

- [ ] **Step 3: ResponseStyleSection (self-edit + Update)**

`components/ai/ResponseStyleSection.tsx` — mirror `WorkspaceAiSettings`/`ai-persona` local-state pattern:
```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useUpdateMyStyle } from '@/lib/hooks/use-ai-context';
import type { AiUserContext } from '@/lib/api/ai-context';

export function ResponseStyleSection({ context }: { context: AiUserContext }) {
  const t = useTranslations('aiContext');
  const save = useUpdateMyStyle();
  const [style, setStyle] = useState(context.style ?? '');
  const [prefs, setPrefs] = useState(context.preferences ?? '');
  const [seed, setSeed] = useState(context);
  if (seed !== context) { setSeed(context); setStyle(context.style ?? ''); setPrefs(context.preferences ?? ''); }
  const dirty = style !== (context.style ?? '') || prefs !== (context.preferences ?? '');
  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="style">{t('styleLabel')}</Label>
        <Textarea id="style" value={style} onChange={(e) => setStyle(e.target.value)} maxLength={2000} placeholder={t('stylePlaceholder')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prefs">{t('preferencesLabel')}</Label>
        <Textarea id="prefs" value={prefs} onChange={(e) => setPrefs(e.target.value)} maxLength={2000} placeholder={t('preferencesPlaceholder')} />
      </div>
      <Button onClick={() => save.mutate({ style, preferences: prefs })} disabled={!dirty || save.isPending}>
        <Save className="mr-2 h-4 w-4" />{save.isPending ? t('saving') : t('update')}
      </Button>
    </Card>
  );
}
```

- [ ] **Step 3b: Write the ResponseStyleSection test**

`components/ai/ResponseStyleSection.test.tsx` (Vitest + Testing Library; mock `useUpdateMyStyle` + `next-intl`): render with a context, type into the style textarea, click Update, assert the mutation `mutate` was called with the new `{ style, preferences }`. (Follow any existing `*.test.tsx` render harness in the repo; if none, wrap in a minimal `QueryClientProvider` and `NextIntlClientProvider` with a stub messages object.)

- [ ] **Step 4: LearnedFactsSection**

`components/ai/LearnedFactsSection.tsx` — consume `useMyMemory()` (single aggregate). Render `memory.keyFacts` as a list, each with a delete affordance; `memory.summary`; `memory.messageCount` badge. Delete calls `useDeleteMemory().mutate(conversationId)` — since the aggregate has `conversationId: null`, deletion of an individual fact is not per-conversation anymore: render delete at the whole-memory level using the existing `DELETE /api/ai/memories/:id` only if a real conversationId exists, otherwise hide per-fact delete and show only the list (individual-fact deletion is out of P3 scope — the endpoint deletes a conversation's doc). Show empty state (`t('memoryEmpty')`, `t('memoryEmptyHint')`) when `keyFacts.length === 0`. Reuse the old `MemoryCard` markup where possible.

> Note: preserve the no-raw-system-data rule — never render `conversationId` or ids; only humanized facts/summary.

- [ ] **Step 5: CompanyContextSection (read-only, already role-filtered)**

`components/ai/CompanyContextSection.tsx` — props `{ entries: AiContextEntry[] }` (already visibility-filtered by the backend). Group by `scope` (Company vs Department), render each `entry.label` + `entry.text` in a `Card`. Show a tier badge from `capabilityToTier(entry.requiredCapability)` with localized labels (`t('tierPublic')`/`t('tierInternal')`/`t('tierConfidential')`). Empty state when no entries.

- [ ] **Step 6: Assemble the page**

Rewrite `apps/web/app/(main)/ai-context/page.tsx` (`'use client'`): header (title `t('title')` + back link to `/settings`), `useMyAiContext()` with `.isLoading`/`error` handling, then stack the four sections (`IdentitySection`, `ResponseStyleSection`, `LearnedFactsSection`, `CompanyContextSection`). Keep under 400 lines by delegating to the section components.

- [ ] **Step 7: Add all new `aiContext.*` keys to 7 locales**

Add to each `messages/*.json` `aiContext` namespace: `title, styleLabel, stylePlaceholder, preferencesLabel, preferencesPlaceholder, update, saving, styleSaved, saveError, roleUnknown, noDepartment, notSet, identityManagedBySuperior, memoryEmpty, memoryEmptyHint, memoryDeleted, deleteError, tierPublic, tierInternal, tierConfidential, companyContextTitle, departmentContextTitle, learnedFactsTitle, responseStyleTitle, identityTitle`. English canonical; add key to every file.

- [ ] **Step 8: Build + test + commit**

```bash
pnpm --filter @platform/web test -- ResponseStyleSection
pnpm --filter @platform/web build
git add apps/web/app/'(main)'/ai-context apps/web/components/ai apps/web/lib/hooks/use-ai-context.ts apps/web/messages
git commit -m "feat(web): AI Context page — identity, response style, learned facts, company context

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Admin — per-member "Edit AI context" (jobTitle, projects)

**Files:**
- Modify: `apps/web/components/admin/MembersPanel.tsx` (add a second per-row action)
- Create: `apps/web/components/admin/EditMemberAiContextModal.tsx`
- Modify: `apps/web/lib/hooks/use-ai-context.ts` (add `useMemberAiContext(userId)` + `useUpdateMemberHard()`)
- Modify: all 7 `messages/*.json` (`admin.*` keys)
- Test: `apps/web/components/admin/EditMemberAiContextModal.test.tsx`

**Interfaces:**
- Produces hooks: `useMemberAiContext(userId, enabled)` (`['ai-context','user',userId]` → `getUser`), `useUpdateMemberHard()` (mutation → `updateUserHard(userId, {jobTitle, projects})`, invalidate the user key + toast).
- The modal is gated: only shown when the actor can manage the member's hard fields (`useHasCapability('MANAGE_MEMBERS')` OR is a dept lead — server enforces regardless; UI shows the action to `MANAGE_MEMBERS` holders and dept-Managers).

- [ ] **Step 1: Hooks**

Add to `use-ai-context.ts`:
```ts
export function useMemberAiContext(userId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ai-context', 'user', userId], queryFn: () => aiContextService.getUser(userId), enabled });
}
export function useUpdateMemberHard() {
  const qc = useQueryClient();
  const t = useTranslations('admin');
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: { jobTitle?: string; projects?: string[] } }) =>
      aiContextService.updateUserHard(userId, body),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['ai-context', 'user', v.userId] }); toast.success(t('toastSaved')); },
    onError: () => toast.error(t('toastError')),
  });
}
```

- [ ] **Step 2: Modal**

`EditMemberAiContextModal.tsx` — props `{ member: Member; open; onOpenChange }`. Use `ResponsiveModal` (existing pattern). `useMemberAiContext(member._id, open)` seeds a jobTitle `Input` + projects editor (comma-split textarea or chip input — a simple `Textarea` where each line is a project is fine; map lines→`projects[]`). Save via `useUpdateMemberHard().mutate({ userId: member._id, body: { jobTitle, projects } })`. Labels via `useTranslations('admin')`.

- [ ] **Step 3: Wire into MembersPanel**

In `MembersPanel.tsx`, add a second icon button per row (e.g. `Brain`/`Sparkles` lucide icon) opening `EditMemberAiContextModal` for that member. Keep the existing role/department `Pencil` action. Gate the new action with `useHasCapability('MANAGE_MEMBERS')` OR dept-lead (if the panel already knows lead status; otherwise show for `MANAGE_MEMBERS` and rely on the server 403 for dept-Managers — but prefer showing to Managers too: show whenever `useHasCapability('MANAGE_MEMBERS')` is true; a dedicated Manager surface can come later).

- [ ] **Step 4: i18n + test + build + commit**

Add `admin.*` keys: `editAiContext, aiContextJobTitle, aiContextProjects, aiContextProjectsHint`. Write `EditMemberAiContextModal.test.tsx` (render, edit jobTitle, save → assert mutate called with `{ userId, body }`).
```bash
pnpm --filter @platform/web test -- EditMemberAiContextModal
pnpm --filter @platform/web build
git add apps/web/components/admin apps/web/lib/hooks/use-ai-context.ts apps/web/messages
git commit -m "feat(web): admin per-member Edit AI context (job title + projects)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Admin — Company AI context editor section

**Files:**
- Create: `apps/web/app/(main)/admin/ai-context/page.tsx`
- Create: `apps/web/components/admin/AiContextEntriesPanel.tsx`
- Modify: `apps/web/components/admin/AdminShell.tsx` (register the section)
- Modify: `apps/web/lib/hooks/use-ai-context.ts` (entries CRUD hooks)
- Modify: all 7 `messages/*.json` (`admin.*` keys)
- Test: `apps/web/components/admin/AiContextEntriesPanel.test.tsx`

**Interfaces:**
- Produces hooks: `useContextEntries(scope, scopeId?)` (`['ai-context','entries',scope,scopeId]` → `listEntries`), `useCreateEntry()`, `useUpdateEntry()`, `useDeleteEntry()` (all invalidate the entries key + toast).
- New admin section entry `{ href: '/admin/ai-context', cap: 'MANAGE_AI_CONTEXT', labelKey: 'aiContext', icon: <Brain/> }` in `ADMIN_SECTIONS`.

- [ ] **Step 1: Entries CRUD hooks** — add to `use-ai-context.ts` (mirror the mutation/toast/invalidate pattern from Task 4).

- [ ] **Step 2: Panel** — `AiContextEntriesPanel.tsx`: a scope toggle (Company / Department + department picker via `useDepartments()`), a list of entries (label, text preview, tier badge) each with edit/delete, and a create/edit modal (`ResponsiveModal`) with fields: label `Input`, text `Textarea`, tier `Select` (Public/Internal/Confidential → `tierToCapability`), and for department scope a department `Select`. Use the CRUD hooks. All labels `useTranslations('admin')`.

- [ ] **Step 3: Route + section registration**

Create `app/(main)/admin/ai-context/page.tsx`: `<RequireCap cap="MANAGE_AI_CONTEXT"><AiContextEntriesPanel /></RequireCap>`. Add the section to `ADMIN_SECTIONS` in `AdminShell.tsx` (filtered by `perms.includes('MANAGE_AI_CONTEXT')`).

- [ ] **Step 4: i18n + test + build + full verify + commit**

Add `admin.*` keys: `aiContext, aiContextEntriesTitle, entryLabel, entryText, entryTier, entryScope, scopeCompany, scopeDepartment, createEntry, editEntry, deleteEntry, deleteEntryConfirm`. Write `AiContextEntriesPanel.test.tsx` (render list, open create modal, submit → assert `createEntry` called with `{scope,label,text,requiredCapability}`).
```bash
pnpm --filter @platform/web test
pnpm --filter @platform/web lint
pnpm --filter @platform/web build
git add apps/web/app/'(main)'/admin/ai-context apps/web/components/admin apps/web/lib/hooks/use-ai-context.ts apps/web/messages
git commit -m "feat(web): admin Company/Department AI context editor (CRUD + tiers)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: full web test suite + lint + build all green.

---

## Self-Review

**Spec coverage (§9 web UI):**
- Rename `/ai-memory` → `/ai-context` + redirect → Task 3. ✅
- Section 1 identity/org (role, dept, jobTitle, projects, read-only) → Task 4 IdentitySection (+ Task 1 backend `identity`). ✅
- Section 2 response style self-edit + **Update** button → Task 4 ResponseStyleSection. ✅
- Section 3 learned facts list + delete → Task 4 LearnedFactsSection (consumes P2b aggregate). ✅
- Section 4 company/department context, role-filtered read-only → Task 4 CompanyContextSection (backend already filters). ✅
- Superior/admin: per-member Edit AI context → Task 5; Company AI context editor w/ tiers → Task 6. ✅
- no-raw-system-data + i18n(7) + sync parity → enforced in every task's constraints. ✅

**Placeholder scan:** No TBD/TODO. Code shown for API client, hooks, and the representative section (ResponseStyle); repetitive sections (Identity, LearnedFacts, CompanyContext, admin panels) have concrete field/behavior specs + the exact pattern file to mirror — not vague. The one judgment call (per-fact vs per-memory delete given the P2b aggregate) is resolved explicitly in Task 4 Step 4.

**Type consistency:** `AiUserContext`/`AiContextEntry`/`MyAiContext`/`ContextTier` defined in Task 2 and consumed in Tasks 4–6. `tierToCapability`/`capabilityToTier` used consistently. `getMyMemories(): AiMemory` (single) consistent between Task 2 and Task 4. Query keys (`['ai-context','me']`, `['ai-memory']`, `['ai-context','user',id]`, `['ai-context','entries',...]`) consistent across hooks and their invalidations.

## Execution Handoff

See end of conversation for execution-mode choice.
