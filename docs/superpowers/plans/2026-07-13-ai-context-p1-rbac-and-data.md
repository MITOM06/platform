# AI Context — P1: RBAC + auth-service Data Model & CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the RBAC capabilities, shared Mongo schemas, and auth-service CRUD (with edit-authority + visibility rules) that back the role-aware AI Context feature — the foundation P2/P3/P4 build on.

**Architecture:** New capabilities live in `packages/database/rbac`. Two new shared Mongo schemas (`ai_context_entries`, `ai_user_context`) live in `packages/database/mongo`. A new `ai-context` NestJS module in **auth-service** owns all CRUD, enforcing authority via the existing `RequirePermissionGuard` for workspace-wide capabilities and a service-layer department-scope check (an actor may manage a department's context / its members' hard fields iff they are that `Department.leadUserId`). Owner/Admin override workspace-wide.

**Tech Stack:** NestJS 10, `@nestjs/mongoose` + Mongoose, `@platform/database` workspace package, Jest, pnpm.

## Global Constraints

- Package manager: **pnpm** (never npm/yarn). Build the DB package before auth: `pnpm --filter @platform/database build`.
- `Capability` is the SINGLE source of truth in `packages/database/src/rbac/capabilities.ts` — never duplicate the list; import `Capability` from `@platform/database`.
- MongoDB is the shared `platform` DB; local port **27018**.
- Entities are `@Document` classes in `packages/database/src/mongo/`; DTOs are separate classes in the module's `dto/`. Never expose schema entities directly where a DTO is expected.
- Constructor injection only (`@RequiredArgsConstructor`-style via NestJS DI); never `new` a service.
- User identity always comes from the JWT (`@CurrentUser() user: JwtUser`, `user.sub`, `user.perms`), never from request body.
- Max 500 lines per NestJS service/controller file; split if exceeded.
- After any change: `pnpm --filter @platform/ai-service...`? No — for this plan run `pnpm --filter @platform/database build` then the auth-service test command in each task.

---

### Task 1: Add the three AI-context capabilities

**Files:**
- Modify: `packages/database/src/rbac/capabilities.ts`
- Modify: `packages/database/src/rbac/preset-roles.ts`
- Test: `packages/database/src/rbac/preset-roles.spec.ts`

**Interfaces:**
- Produces: `Capability.MANAGE_AI_CONTEXT`, `Capability.VIEW_INTERNAL_CONTEXT`, `Capability.VIEW_CONFIDENTIAL_CONTEXT` (string enum members, value === key).

- [ ] **Step 1: Update the preset-roles test to expect the new grants**

In `packages/database/src/rbac/preset-roles.spec.ts`, find the existing per-role assertions and add expectations. If the spec asserts full matrices, add these lines to the relevant role blocks; otherwise add a new `it`:

```ts
it('grants AI-context capabilities per the design tiers', () => {
  const byName = (n: string) => PRESET_ROLES.find((r) => r.name === n)!.permissions;

  // Owner has everything (buildFullMatrix)
  expect(byName('Owner')[Capability.MANAGE_AI_CONTEXT]).toBe(true);
  expect(byName('Owner')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(true);

  // Admin: manage + both view tiers
  expect(byName('Admin')[Capability.MANAGE_AI_CONTEXT]).toBe(true);
  expect(byName('Admin')[Capability.VIEW_INTERNAL_CONTEXT]).toBe(true);
  expect(byName('Admin')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(true);

  // Manager: internal view only, no workspace-wide manage, no confidential
  expect(byName('Manager')[Capability.MANAGE_AI_CONTEXT]).toBe(false);
  expect(byName('Manager')[Capability.VIEW_INTERNAL_CONTEXT]).toBe(true);
  expect(byName('Manager')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(false);

  // Member: none
  expect(byName('Member')[Capability.MANAGE_AI_CONTEXT]).toBe(false);
  expect(byName('Member')[Capability.VIEW_INTERNAL_CONTEXT]).toBe(false);
  expect(byName('Member')[Capability.VIEW_CONFIDENTIAL_CONTEXT]).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @platform/database test -- preset-roles`
Expected: FAIL — `Capability.MANAGE_AI_CONTEXT` is `undefined` / property missing.

- [ ] **Step 3: Add the enum members**

In `packages/database/src/rbac/capabilities.ts`, add inside `enum Capability` (after `VIEW_AUDIT_LOG`):

```ts
  /** Create/edit/delete company & department AI-context entries. */
  MANAGE_AI_CONTEXT = 'MANAGE_AI_CONTEXT',
  /** Receive "Internal"-tier company/department context in the AI prompt. */
  VIEW_INTERNAL_CONTEXT = 'VIEW_INTERNAL_CONTEXT',
  /** Receive "Confidential"-tier company/department context in the AI prompt. */
  VIEW_CONFIDENTIAL_CONTEXT = 'VIEW_CONFIDENTIAL_CONTEXT',
```

- [ ] **Step 4: Grant them in the preset matrix**

In `packages/database/src/rbac/preset-roles.ts`, `Owner` already gets them via `buildFullMatrix(true)`. Add explicit keys to `Admin`, `Manager`, `Member` blocks:

Admin (all true):
```ts
      [C.MANAGE_AI_CONTEXT]: true,
      [C.VIEW_INTERNAL_CONTEXT]: true,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: true,
```
Manager (internal view only):
```ts
      [C.MANAGE_AI_CONTEXT]: false,
      [C.VIEW_INTERNAL_CONTEXT]: true,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: false,
```
Member (none):
```ts
      [C.MANAGE_AI_CONTEXT]: false,
      [C.VIEW_INTERNAL_CONTEXT]: false,
      [C.VIEW_CONFIDENTIAL_CONTEXT]: false,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @platform/database test -- preset-roles`
Expected: PASS.

- [ ] **Step 6: Build the package + commit**

```bash
pnpm --filter @platform/database build
git add packages/database/src/rbac/capabilities.ts packages/database/src/rbac/preset-roles.ts packages/database/src/rbac/preset-roles.spec.ts
git commit -m "feat(rbac): add AI-context capabilities (manage + internal/confidential view)"
```

> **Note (rollout):** capabilities are resolved into the JWT `perms` claim at login. Existing sessions won't have the new perms until token refresh / re-login. Preset roles auto-seed on bootstrap; no data migration.

---

### Task 2: `ai_context_entries` schema (company & department notes)

**Files:**
- Create: `packages/database/src/mongo/ai-context-entry.schema.ts`
- Modify: `packages/database/src/index.ts`
- Test: `packages/database/src/mongo/ai-context-entry.schema.spec.ts`

**Interfaces:**
- Produces: `AiContextEntry` class, `AiContextEntrySchema`, `AiContextEntryDocument`, `ContextScope = 'company' | 'department'`.

- [ ] **Step 1: Write the schema**

```ts
import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Capability } from '../rbac/capabilities';

export type AiContextEntryDocument = AiContextEntry & Document;
export type ContextScope = 'company' | 'department';

/**
 * A curated company- or department-level context note fed into the AI prompt.
 * `requiredCapability` gates sensitivity: null = public; otherwise only users
 * whose resolved `perms` include that capability receive the entry.
 */
@NestSchema({ timestamps: true, collection: 'ai_context_entries' })
export class AiContextEntry {
  @Prop({ required: true, enum: ['company', 'department'], index: true })
  scope: ContextScope;

  /** null for company scope; the departmentId string for department scope. */
  @Prop({ type: String, default: null, index: true })
  scopeId: string | null;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  text: string;

  /** null = public. Otherwise a Capability key required to receive this entry. */
  @Prop({ type: String, default: null })
  requiredCapability: Capability | null;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true })
  updatedBy: string;
}

export const AiContextEntrySchema = SchemaFactory.createForClass(AiContextEntry);
```

- [ ] **Step 2: Export from the package index**

In `packages/database/src/index.ts`, add after the other mongo exports:
```ts
export * from './mongo/ai-context-entry.schema';
```

- [ ] **Step 3: Write a schema sanity test**

`packages/database/src/mongo/ai-context-entry.schema.spec.ts`:
```ts
import { AiContextEntrySchema } from './ai-context-entry.schema';

describe('AiContextEntrySchema', () => {
  it('binds to the ai_context_entries collection with timestamps', () => {
    expect(AiContextEntrySchema.get('collection')).toBe('ai_context_entries');
    expect(AiContextEntrySchema.get('timestamps')).toBe(true);
  });

  it('defaults requiredCapability and scopeId to null', () => {
    const paths = AiContextEntrySchema.paths;
    expect(paths['requiredCapability'].options.default).toBeNull();
    expect(paths['scopeId'].options.default).toBeNull();
  });
});
```

- [ ] **Step 4: Run + build + commit**

```bash
pnpm --filter @platform/database test -- ai-context-entry.schema
pnpm --filter @platform/database build
git add packages/database/src/mongo/ai-context-entry.schema.ts packages/database/src/mongo/ai-context-entry.schema.spec.ts packages/database/src/index.ts
git commit -m "feat(db): add ai_context_entries schema"
```
Expected: PASS then clean build.

---

### Task 3: `ai_user_context` schema (per-user profile)

**Files:**
- Create: `packages/database/src/mongo/ai-user-context.schema.ts`
- Modify: `packages/database/src/index.ts`
- Test: `packages/database/src/mongo/ai-user-context.schema.spec.ts`

**Interfaces:**
- Produces: `AiUserContext` class, `AiUserContextSchema`, `AiUserContextDocument`. Fields: `userId` (unique), `jobTitle`, `projects: string[]`, `style`, `preferences`, `updatedBy`.

- [ ] **Step 1: Write the schema**

```ts
import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiUserContextDocument = AiUserContext & Document;

/**
 * Per-user AI context profile. Hard fields (jobTitle, projects) are edited only
 * by superiors; soft fields (style, preferences) are edited only by the owning
 * user. Role & department NAMES are NOT stored here — derive from User/Role/Department.
 */
@NestSchema({ timestamps: true, collection: 'ai_user_context' })
export class AiUserContext {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ default: '' })
  jobTitle: string;

  @Prop({ type: [String], default: [] })
  projects: string[];

  @Prop({ default: '' })
  style: string;

  @Prop({ default: '' })
  preferences: string;

  @Prop({ required: true })
  updatedBy: string;
}

export const AiUserContextSchema = SchemaFactory.createForClass(AiUserContext);
```

- [ ] **Step 2: Export from the index**

In `packages/database/src/index.ts` add:
```ts
export * from './mongo/ai-user-context.schema';
```

- [ ] **Step 3: Schema sanity test**

`packages/database/src/mongo/ai-user-context.schema.spec.ts`:
```ts
import { AiUserContextSchema } from './ai-user-context.schema';

describe('AiUserContextSchema', () => {
  it('binds to ai_user_context and makes userId unique', () => {
    expect(AiUserContextSchema.get('collection')).toBe('ai_user_context');
    expect(AiUserContextSchema.paths['userId'].options.unique).toBe(true);
  });

  it('defaults projects to an empty array', () => {
    expect(AiUserContextSchema.paths['projects'].options.default).toEqual([]);
  });
});
```

- [ ] **Step 4: Run + build + commit**

```bash
pnpm --filter @platform/database test -- ai-user-context.schema
pnpm --filter @platform/database build
git add packages/database/src/mongo/ai-user-context.schema.ts packages/database/src/mongo/ai-user-context.schema.spec.ts packages/database/src/index.ts
git commit -m "feat(db): add ai_user_context schema"
```
Expected: PASS then clean build.

---

### Task 4: DTOs + module scaffold

**Files:**
- Create: `apps/server/auth-service/src/modules/ai-context/dto/ai-context.dto.ts`
- Create: `apps/server/auth-service/src/modules/ai-context/ai-context.module.ts`
- Modify: `apps/server/auth-service/src/app.module.ts`

**Interfaces:**
- Produces DTO classes: `UpdateSoftContextDto { style?: string; preferences?: string }`, `UpdateHardContextDto { jobTitle?: string; projects?: string[] }`, `UpsertEntryDto { scope: 'company'|'department'; scopeId?: string|null; label: string; text: string; requiredCapability?: Capability|null }`.
- Produces `AiContextModule` (registers the two Mongoose models + controller + service).

- [ ] **Step 1: Write the DTOs**

```ts
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Capability } from '@platform/database';

export class UpdateSoftContextDto {
  @IsOptional() @IsString() @MaxLength(2000)
  style?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  preferences?: string;
}

export class UpdateHardContextDto {
  @IsOptional() @IsString() @MaxLength(200)
  jobTitle?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  projects?: string[];
}

export class UpsertEntryDto {
  @IsIn(['company', 'department'])
  scope: 'company' | 'department';

  @IsOptional() @IsString()
  scopeId?: string | null;

  @IsString() @MaxLength(120)
  label: string;

  @IsString() @MaxLength(4000)
  text: string;

  @IsOptional() @IsEnum(Capability)
  requiredCapability?: Capability | null;
}
```

- [ ] **Step 2: Write the module (models registered; service/controller added in Tasks 5–7)**

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  AiContextEntry,
  AiContextEntrySchema,
  AiUserContext,
  AiUserContextSchema,
  Department,
  DepartmentSchema,
  User,
  UserSchema,
} from '@platform/database';
import { AiContextService } from './ai-context.service';
import { AiContextController } from './ai-context.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: AiContextEntry.name, schema: AiContextEntrySchema },
      { name: AiUserContext.name, schema: AiUserContextSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AiContextController],
  providers: [AiContextService],
})
export class AiContextModule {}
```

> The `AiContextService` and `AiContextController` imports will not resolve until Tasks 5–7. Create empty stub files now so the module compiles:
> - `apps/server/auth-service/src/modules/ai-context/ai-context.service.ts` → `import { Injectable } from '@nestjs/common'; @Injectable() export class AiContextService {}`
> - `apps/server/auth-service/src/modules/ai-context/ai-context.controller.ts` → `import { Controller } from '@nestjs/common'; @Controller('ai-context') export class AiContextController {}`

- [ ] **Step 3: Register the module**

In `apps/server/auth-service/src/app.module.ts`, add `AiContextModule` to the `imports` array (mirror how `WorkspaceModule`/`AdminModule` are imported).

- [ ] **Step 4: Verify it compiles + commit**

```bash
pnpm --filter @platform/database build
pnpm --filter @platform/auth-service build
git add apps/server/auth-service/src/modules/ai-context/ apps/server/auth-service/src/app.module.ts
git commit -m "feat(auth): scaffold ai-context module + DTOs"
```
Expected: clean build (stubs compile).

---

### Task 5: Service — per-user context (soft self-edit, hard superior-edit)

**Files:**
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.service.ts`
- Test: `apps/server/auth-service/src/modules/ai-context/ai-context.service.spec.ts`

**Interfaces:**
- Consumes: `AiUserContext`/`AiUserContextDocument`, `User`/`UserDocument`, `Department`/`DepartmentDocument` models; `Capability` from `@platform/database`; `JwtUser` (`{ sub: string; perms: string[] }`).
- Produces on `AiContextService`:
  - `getUserContext(userId: string): Promise<AiUserContext>` — returns existing or a zero-value default (never null).
  - `updateSoftContext(actorId: string, dto: { style?: string; preferences?: string }): Promise<AiUserContext>` — upserts the actor's OWN doc.
  - `updateHardContext(actor: { sub: string; perms: string[] }, targetUserId: string, dto: { jobTitle?: string; projects?: string[] }): Promise<AiUserContext>` — throws `ForbiddenException` unless `canManageMemberHardFields`.
  - `canManageMemberHardFields(actor: { sub: string; perms: string[] }, targetUserId: string): Promise<boolean>` — true if `perms` includes `MANAGE_MEMBERS`, OR the actor is `leadUserId` of a department that `targetUserId` belongs to.

- [ ] **Step 1: Write the failing tests**

```ts
import { ForbiddenException } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { Capability } from '@platform/database';

function makeModels(over: any = {}) {
  const userCtx = {
    findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.userCtx ?? null) }) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.upserted ?? { userId: 'u1' }) }) }),
  };
  const user = {
    findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.targetUser ?? { _id: 'target', departmentIds: [] }) }) }),
  };
  const dept = {
    find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.leadDepts ?? []) }) }),
  };
  return { userCtx, user, dept };
}

function makeService(over: any = {}) {
  const m = makeModels(over);
  return {
    svc: new AiContextService(m.userCtx as any, {} as any, m.user as any, m.dept as any),
    m,
  };
}

describe('AiContextService — per-user context', () => {
  it('updateSoftContext upserts the actor own doc', async () => {
    const { svc, m } = makeService({ upserted: { userId: 'u1', style: 'brief' } });
    const res = await svc.updateSoftContext('u1', { style: 'brief' });
    expect(m.userCtx.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { style: 'brief', updatedBy: 'u1' } },
      { upsert: true, new: true },
    );
    expect(res.style).toBe('brief');
  });

  it('updateHardContext throws for a Member with no authority', async () => {
    const { svc } = makeService({ targetUser: { _id: 'target', departmentIds: ['d1'] }, leadDepts: [] });
    await expect(
      svc.updateHardContext({ sub: 'member', perms: [] }, 'target', { jobTitle: 'Dev' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateHardContext allows a workspace admin (MANAGE_MEMBERS)', async () => {
    const { svc, m } = makeService({ upserted: { userId: 'target', jobTitle: 'Dev' } });
    const res = await svc.updateHardContext(
      { sub: 'admin', perms: [Capability.MANAGE_MEMBERS] }, 'target', { jobTitle: 'Dev' },
    );
    expect(res.jobTitle).toBe('Dev');
    expect(m.userCtx.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'target' },
      { $set: { jobTitle: 'Dev', updatedBy: 'admin' } },
      { upsert: true, new: true },
    );
  });

  it('updateHardContext allows a department lead over a member of their dept', async () => {
    const { svc } = makeService({
      targetUser: { _id: 'target', departmentIds: ['d1'] },
      leadDepts: [{ _id: 'd1', leadUserId: 'manager' }],
      upserted: { userId: 'target', jobTitle: 'Dev' },
    });
    const res = await svc.updateHardContext({ sub: 'manager', perms: [] }, 'target', { jobTitle: 'Dev' });
    expect(res.jobTitle).toBe('Dev');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @platform/auth-service test -- ai-context.service`
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Implement the service methods**

Replace the stub `ai-context.service.ts` with:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AiContextEntry,
  AiContextEntryDocument,
  AiUserContext,
  AiUserContextDocument,
  Capability,
  Department,
  DepartmentDocument,
  User,
  UserDocument,
} from '@platform/database';

export interface Actor {
  sub: string;
  perms: string[];
}

const EMPTY_CONTEXT = (userId: string): AiUserContext =>
  ({ userId, jobTitle: '', projects: [], style: '', preferences: '', updatedBy: userId } as AiUserContext);

@Injectable()
export class AiContextService {
  constructor(
    @InjectModel(AiUserContext.name) private readonly userCtxModel: Model<AiUserContextDocument>,
    @InjectModel(AiContextEntry.name) private readonly entryModel: Model<AiContextEntryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name) private readonly deptModel: Model<DepartmentDocument>,
  ) {}

  async getUserContext(userId: string): Promise<AiUserContext> {
    const doc = await this.userCtxModel.findOne({ userId }).lean().exec();
    return (doc as AiUserContext) ?? EMPTY_CONTEXT(userId);
  }

  async updateSoftContext(
    actorId: string,
    dto: { style?: string; preferences?: string },
  ): Promise<AiUserContext> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.style !== undefined) set.style = dto.style;
    if (dto.preferences !== undefined) set.preferences = dto.preferences;
    return this.userCtxModel
      .findOneAndUpdate({ userId: actorId }, { $set: set }, { upsert: true, new: true })
      .lean()
      .exec() as Promise<AiUserContext>;
  }

  async updateHardContext(
    actor: Actor,
    targetUserId: string,
    dto: { jobTitle?: string; projects?: string[] },
  ): Promise<AiUserContext> {
    if (!(await this.canManageMemberHardFields(actor, targetUserId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    const set: Record<string, unknown> = { updatedBy: actor.sub };
    if (dto.jobTitle !== undefined) set.jobTitle = dto.jobTitle;
    if (dto.projects !== undefined) set.projects = dto.projects;
    return this.userCtxModel
      .findOneAndUpdate({ userId: targetUserId }, { $set: set }, { upsert: true, new: true })
      .lean()
      .exec() as Promise<AiUserContext>;
  }

  async canManageMemberHardFields(actor: Actor, targetUserId: string): Promise<boolean> {
    if (actor.perms.includes(Capability.MANAGE_MEMBERS)) return true;
    const target = await this.userModel.findById(targetUserId).lean().exec();
    if (!target) return false;
    const targetDeptIds = ((target as unknown as { departmentIds?: unknown[] }).departmentIds ?? []).map(
      (d) => String(d),
    );
    if (targetDeptIds.length === 0) return false;
    const ledDepts = await this.deptModel.find({ leadUserId: actor.sub }).lean().exec();
    return ledDepts.some((d) => targetDeptIds.includes(String((d as { _id: unknown })._id)));
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @platform/auth-service test -- ai-context.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/auth-service/src/modules/ai-context/ai-context.service.ts apps/server/auth-service/src/modules/ai-context/ai-context.service.spec.ts
git commit -m "feat(auth): per-user AI context (soft self-edit, hard superior-edit)"
```

---

### Task 6: Service — company/department entries CRUD + visibility

**Files:**
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.service.ts`
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.service.spec.ts`

**Interfaces:**
- Produces on `AiContextService`:
  - `listEntries(scope: 'company'|'department', scopeId?: string|null): Promise<AiContextEntry[]>` — raw editor list (no visibility filter).
  - `upsertEntry(actor: Actor, dto: UpsertEntryShape, id?: string): Promise<AiContextEntry>` — throws `ForbiddenException` unless `canManageEntryScope`.
  - `deleteEntry(actor: Actor, id: string): Promise<void>` — same authority.
  - `canManageEntryScope(actor: Actor, scope: 'company'|'department', scopeId?: string|null): Promise<boolean>` — company → `MANAGE_AI_CONTEXT`; department → `MANAGE_AI_CONTEXT` OR actor is that dept's `leadUserId`.
  - `getVisibleEntriesForUser(userId: string, perms: string[], departmentIds: string[]): Promise<AiContextEntry[]>` — company entries whose `requiredCapability` is null or held; plus department entries for the user's departments passing the same gate.
- Where `UpsertEntryShape = { scope: 'company'|'department'; scopeId?: string|null; label: string; text: string; requiredCapability?: Capability|null }`.

- [ ] **Step 1: Add the failing tests**

Append to `ai-context.service.spec.ts`. Extend `makeModels` to give `entryModel` methods, then:

```ts
describe('AiContextService — entries', () => {
  function makeEntryService(over: any = {}) {
    const entry = {
      find: jest.fn().mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve(over.entries ?? []) }) }) }),
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.entry ?? null) }) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.saved ?? {}) }) }),
      create: jest.fn().mockResolvedValue(over.saved ?? { scope: 'company' }),
      deleteOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const dept = {
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(over.dept ?? null) }) }),
      find: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
    };
    const svc = new AiContextService({} as any, entry as any, {} as any, dept as any);
    return { svc, entry, dept };
  }

  it('company entry create requires MANAGE_AI_CONTEXT', async () => {
    const { svc } = makeEntryService();
    await expect(
      svc.upsertEntry({ sub: 'm', perms: [] }, { scope: 'company', label: 'x', text: 'y' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('company entry create allowed with MANAGE_AI_CONTEXT', async () => {
    const { svc, entry } = makeEntryService({ saved: { scope: 'company', label: 'x' } });
    const res = await svc.upsertEntry(
      { sub: 'admin', perms: [Capability.MANAGE_AI_CONTEXT] },
      { scope: 'company', label: 'x', text: 'y' },
    );
    expect(entry.create).toHaveBeenCalled();
    expect(res.label).toBe('x');
  });

  it('department entry allowed for the department lead without MANAGE_AI_CONTEXT', async () => {
    const { svc } = makeEntryService({ dept: { _id: 'd1', leadUserId: 'manager' }, saved: { scope: 'department' } });
    const ok = await svc.canManageEntryScope({ sub: 'manager', perms: [] }, 'department', 'd1');
    expect(ok).toBe(true);
  });

  it('getVisibleEntriesForUser filters by requiredCapability', async () => {
    const entries = [
      { scope: 'company', requiredCapability: null, text: 'public' },
      { scope: 'company', requiredCapability: Capability.VIEW_CONFIDENTIAL_CONTEXT, text: 'secret' },
    ];
    const { svc } = makeEntryService({ entries });
    const visible = await svc.getVisibleEntriesForUser('u1', [Capability.VIEW_INTERNAL_CONTEXT], []);
    expect(visible.map((e) => e.text)).toEqual(['public']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @platform/auth-service test -- ai-context.service`
Expected: FAIL — new methods undefined.

- [ ] **Step 3: Implement the entry methods**

Add these methods (and imports already present) to `AiContextService`:

```ts
  async canManageEntryScope(
    actor: Actor,
    scope: 'company' | 'department',
    scopeId?: string | null,
  ): Promise<boolean> {
    if (actor.perms.includes(Capability.MANAGE_AI_CONTEXT)) return true;
    if (scope === 'department' && scopeId) {
      const dept = await this.deptModel.findById(scopeId).lean().exec();
      return !!dept && String((dept as { leadUserId?: unknown }).leadUserId) === actor.sub;
    }
    return false;
  }

  async listEntries(scope: 'company' | 'department', scopeId?: string | null): Promise<AiContextEntry[]> {
    const filter: Record<string, unknown> = { scope };
    if (scope === 'department') filter.scopeId = scopeId ?? null;
    return this.entryModel.find(filter).sort({ updatedAt: -1 }).lean().exec() as Promise<AiContextEntry[]>;
  }

  async upsertEntry(
    actor: Actor,
    dto: {
      scope: 'company' | 'department';
      scopeId?: string | null;
      label: string;
      text: string;
      requiredCapability?: Capability | null;
    },
    id?: string,
  ): Promise<AiContextEntry> {
    if (!(await this.canManageEntryScope(actor, dto.scope, dto.scopeId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    const base = {
      scope: dto.scope,
      scopeId: dto.scope === 'department' ? dto.scopeId ?? null : null,
      label: dto.label,
      text: dto.text,
      requiredCapability: dto.requiredCapability ?? null,
      updatedBy: actor.sub,
    };
    if (id) {
      return this.entryModel
        .findByIdAndUpdate(id, { $set: base }, { new: true })
        .lean()
        .exec() as Promise<AiContextEntry>;
    }
    return this.entryModel.create({ ...base, createdBy: actor.sub }) as unknown as Promise<AiContextEntry>;
  }

  async deleteEntry(actor: Actor, id: string): Promise<void> {
    const entry = await this.entryModel.findById(id).lean().exec();
    if (!entry) return;
    const e = entry as unknown as { scope: 'company' | 'department'; scopeId?: string | null };
    if (!(await this.canManageEntryScope(actor, e.scope, e.scopeId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    await this.entryModel.deleteOne({ _id: id }).exec();
  }

  async getVisibleEntriesForUser(
    _userId: string,
    perms: string[],
    departmentIds: string[],
  ): Promise<AiContextEntry[]> {
    const gate = (cap: Capability | null | undefined) => cap == null || perms.includes(cap);
    const company = (await this.entryModel.find({ scope: 'company' }).sort({ updatedAt: -1 }).lean().exec()) as AiContextEntry[];
    let dept: AiContextEntry[] = [];
    if (departmentIds.length > 0) {
      dept = (await this.entryModel
        .find({ scope: 'department', scopeId: { $in: departmentIds } })
        .sort({ updatedAt: -1 })
        .lean()
        .exec()) as AiContextEntry[];
    }
    return [...company, ...dept].filter((e) => gate(e.requiredCapability));
  }
```

> Note: the `getVisibleEntriesForUser` test stubs `entry.find(...).sort(...).lean().exec()` — ensure the department branch is skipped when `departmentIds` is empty (as in the test) so the single `find` stub returns the company list.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @platform/auth-service test -- ai-context.service`
Expected: PASS (all Task 5 + Task 6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/auth-service/src/modules/ai-context/ai-context.service.ts apps/server/auth-service/src/modules/ai-context/ai-context.service.spec.ts
git commit -m "feat(auth): company/department context entries CRUD + role-gated visibility"
```

---

### Task 7: Controller — REST surface + guards

**Files:**
- Modify: `apps/server/auth-service/src/modules/ai-context/ai-context.controller.ts`
- Test: `apps/server/auth-service/src/modules/ai-context/ai-context.controller.spec.ts`

**Interfaces:**
- Consumes: `AiContextService`, `RequirePermission`/`RequirePermissionGuard`, `@CurrentUser() user: JwtUser`.
- Produces routes (all under `@Controller('ai-context')`, `@UseGuards(AuthGuard('jwt'), RequirePermissionGuard)`):
  - `GET  /ai-context/me` → `{ context: AiUserContext; entries: AiContextEntry[] }` (self view; entries visibility-filtered).
  - `PATCH /ai-context/me/style` (body `UpdateSoftContextDto`) → `AiUserContext`.
  - `GET  /ai-context/users/:userId` → `AiUserContext` (superior view; authority checked in service).
  - `PATCH /ai-context/users/:userId/hard` (body `UpdateHardContextDto`) → `AiUserContext`.
  - `GET  /ai-context/entries?scope=&scopeId=` → `AiContextEntry[]`, guarded `@RequirePermission(MANAGE_AI_CONTEXT)`.
  - `POST /ai-context/entries` (body `UpsertEntryDto`) → `AiContextEntry` (dept-lead path handled in service; see note).
  - `PATCH /ai-context/entries/:id` (body `UpsertEntryDto`) → `AiContextEntry`.
  - `DELETE /ai-context/entries/:id` → 204.

> **Guard nuance:** `POST/PATCH/DELETE /entries` must allow a department lead who lacks the `MANAGE_AI_CONTEXT` capability. Do NOT put `@RequirePermission(MANAGE_AI_CONTEXT)` on those routes — authentication only, then the service's `canManageEntryScope` throws 403 when unauthorized. Only `GET /entries` (the admin editor list) carries `@RequirePermission(MANAGE_AI_CONTEXT)`.

- [ ] **Step 1: Write the failing controller test**

```ts
import { AiContextController } from './ai-context.controller';

describe('AiContextController', () => {
  const svc = {
    getUserContext: jest.fn().mockResolvedValue({ userId: 'u1', style: 's' }),
    getVisibleEntriesForUser: jest.fn().mockResolvedValue([{ label: 'x' }]),
    updateSoftContext: jest.fn().mockResolvedValue({ userId: 'u1', style: 'brief' }),
    updateHardContext: jest.fn().mockResolvedValue({ userId: 'target', jobTitle: 'Dev' }),
    upsertEntry: jest.fn().mockResolvedValue({ label: 'x' }),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
    listEntries: jest.fn().mockResolvedValue([]),
  } as any;
  const ctrl = new AiContextController(svc);
  const user = { sub: 'u1', perms: ['VIEW_INTERNAL_CONTEXT'], departmentIds: [] } as any;

  it('GET /me aggregates context + visible entries', async () => {
    const res = await ctrl.getMine(user);
    expect(res.context.style).toBe('s');
    expect(res.entries).toEqual([{ label: 'x' }]);
    expect(svc.getVisibleEntriesForUser).toHaveBeenCalledWith('u1', user.perms, []);
  });

  it('PATCH /me/style updates soft fields for the caller', async () => {
    const res = await ctrl.updateMyStyle(user, { style: 'brief' });
    expect(svc.updateSoftContext).toHaveBeenCalledWith('u1', { style: 'brief' });
    expect(res.style).toBe('brief');
  });

  it('PATCH /users/:id/hard delegates to service authority check', async () => {
    await ctrl.updateHard(user, 'target', { jobTitle: 'Dev' });
    expect(svc.updateHardContext).toHaveBeenCalledWith(
      { sub: 'u1', perms: user.perms }, 'target', { jobTitle: 'Dev' },
    );
  });
});
```

> `JwtUser` includes `departmentIds` on the claims. If it does not in this codebase, read it from `user.departmentIds ?? []` and, if absent, pass `[]` — the visible-entries call still works (company entries only). Verify `JwtUser` shape in `packages/database/src/auth/jwt-user.interface.ts` during implementation and adjust the `.departmentIds` access accordingly.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @platform/auth-service test -- ai-context.controller`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Implement the controller**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Capability, CurrentUser, JwtUser } from '@platform/database';
import {
  RequirePermission,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { AiContextService } from './ai-context.service';
import {
  UpdateHardContextDto,
  UpdateSoftContextDto,
  UpsertEntryDto,
} from './dto/ai-context.dto';

@ApiTags('ai-context')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RequirePermissionGuard)
@Controller('ai-context')
export class AiContextController {
  constructor(private readonly service: AiContextService) {}

  private deptIds(user: JwtUser): string[] {
    return ((user as unknown as { departmentIds?: unknown[] }).departmentIds ?? []).map((d) => String(d));
  }

  @Get('me')
  async getMine(@CurrentUser() user: JwtUser) {
    const [context, entries] = await Promise.all([
      this.service.getUserContext(user.sub),
      this.service.getVisibleEntriesForUser(user.sub, user.perms ?? [], this.deptIds(user)),
    ]);
    return { context, entries };
  }

  @Patch('me/style')
  updateMyStyle(@CurrentUser() user: JwtUser, @Body() dto: UpdateSoftContextDto) {
    return this.service.updateSoftContext(user.sub, dto);
  }

  @Get('users/:userId')
  getUser(@Param('userId') userId: string) {
    return this.service.getUserContext(userId);
  }

  @Patch('users/:userId/hard')
  updateHard(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateHardContextDto,
  ) {
    return this.service.updateHardContext({ sub: user.sub, perms: user.perms ?? [] }, userId, dto);
  }

  @Get('entries')
  @RequirePermission(Capability.MANAGE_AI_CONTEXT)
  listEntries(@Query('scope') scope: 'company' | 'department', @Query('scopeId') scopeId?: string) {
    return this.service.listEntries(scope, scopeId ?? null);
  }

  @Post('entries')
  createEntry(@CurrentUser() user: JwtUser, @Body() dto: UpsertEntryDto) {
    return this.service.upsertEntry({ sub: user.sub, perms: user.perms ?? [] }, dto);
  }

  @Patch('entries/:id')
  updateEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertEntryDto,
  ) {
    return this.service.upsertEntry({ sub: user.sub, perms: user.perms ?? [] }, dto, id);
  }

  @Delete('entries/:id')
  @HttpCode(204)
  deleteEntry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteEntry({ sub: user.sub, perms: user.perms ?? [] }, id);
  }
}
```

- [ ] **Step 4: Run to verify pass + full auth-service build/test**

```bash
pnpm --filter @platform/auth-service test -- ai-context.controller
pnpm --filter @platform/auth-service build
pnpm --filter @platform/auth-service test
```
Expected: new controller tests PASS; full build clean; full suite green (no regressions).

- [ ] **Step 5: Commit**

```bash
git add apps/server/auth-service/src/modules/ai-context/ai-context.controller.ts apps/server/auth-service/src/modules/ai-context/ai-context.controller.spec.ts
git commit -m "feat(auth): ai-context REST controller (self view, hard fields, entries CRUD)"
```

---

## Self-Review

**Spec coverage (P1 portion of `2026-07-13-role-aware-ai-context-design.md`):**
- §3.1 `ai_context_entries` schema → Task 2. ✅
- §3.2 `ai_user_context` schema → Task 3. ✅
- §4 three new capabilities + preset matrix → Task 1. ✅
- §4.1 edit authority (company=MANAGE_AI_CONTEXT; dept=cap OR dept-lead; user-hard=MANAGE_MEMBERS OR dept-lead; user-soft=self) → Tasks 5–7. ✅
- §4.2 read visibility (capability gate) → Task 6 `getVisibleEntriesForUser` + Task 7 `GET /me`. ✅
- §5 auth-service owns CRUD via existing guards → Tasks 4–7. ✅
- Deferred to later plans (correctly out of P1 scope): §5 chat-service payload, §6 memory re-scope, §7 prompt assembly (P2); §9 UI (P3/P4). Noted, not gaps.

**Placeholder scan:** No TBD/TODO; every code step contains full code. Two explicit "verify shape during implementation" notes (`JwtUser.departmentIds`) are guarded with a concrete fallback (`?? []`), not placeholders.

**Type consistency:** `Actor = { sub, perms }` used consistently across service + controller. `canManageEntryScope`, `canManageMemberHardFields`, `getVisibleEntriesForUser`, `upsertEntry`, `updateSoftContext`, `updateHardContext` names match between Interfaces blocks, tests, and implementations. `requiredCapability` (nullable) consistent across schema/DTO/service/tests.

## Execution Handoff

See end of conversation for execution-mode choice.
