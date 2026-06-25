# Identity Bridge — Bot Factory ↔ Connector-Service

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for Tasks 1–3 (backend). Use `superpowers:orchestrate-feature` for Task 4 (admin UI — web + Flutter parity required per `sync.md`).

**Goal:** Let a Bot Factory personal assistant bot access the PON member's connected tools (Gmail, Google Calendar, Notion, etc.) via connector-service — so the personal assistant can actually act on behalf of the user, not just chat. Bot Factory is **never modified**.

---

## Problem & Solution

Bot Factory currently receives only a text message and returns a reply. It has no way to call the user's Gmail or Calendar because it doesn't know the user's PON identity.

**Solution — PON exposes an MCP server endpoint inside connector-service:**

```
Admin registers bot for user (already done via ExternalBotController)
  → Admin clicks "Generate token" in PON admin panel
  → connector-service creates a BotSessionToken scoped to { userId, botUserId }
  → Admin copies the token + MCP URL, pastes into Bot Factory as a custom HTTP MCP server
  → Bot Factory bot now has mcp__gmail__*, mcp__calendar__*, etc. in its tool list
  → When member sends a message, Bot Factory calls those tools on behalf of that member
  → connector-service validates the bearer token → resolves userId → executes with RBAC
```

**Why this works without touching Bot Factory:** Bot Factory already supports custom MCP servers (HTTP transport) configurable per bot via its UI. The PON MCP endpoint speaks the standard MCP Streamable HTTP protocol (`@modelcontextprotocol/sdk` v1.29.0 is already installed in connector-service).

---

## Architecture

```
Bot Factory bot
  │  POST /mcp  Bearer: <botSessionToken>
  ▼
connector-service :3003
  McpServerController
    │  validates token → resolves userId
    ▼
  InternalService.getTools(userId) / callTool(userId, name, input)
    │  (existing, already RBAC-gated)
    ▼
  User's Gmail / Calendar / Notion connections
```

**Token format:** 32-byte cryptographically random token. Stored as SHA-256 hash in MongoDB (so the vault only sees the hash — the plaintext token is returned once at creation and never stored). Token is scoped to one `(userId, botUserId)` pair and can be revoked.

---

## Global Constraints

- **NestJS conventions** (connector-service): constructor injection, `@RequiredArgsConstructor` pattern via DI, `ConfigService` for env, NestJS `Logger`, max 300 lines/file.
- **Do NOT modify** `auth-service/` or the Bot Factory repo.
- **`@platform/database` shared guard** (`JwtAuthGuard` + `@RequirePermission`) for the token-issuance endpoint (admin-only).
- **`PERM_MANAGE_WORKSPACE`** capability required to generate/revoke tokens.
- **MCP Streamable HTTP** — use `@modelcontextprotocol/sdk` Server + `StreamableHTTPServerTransport` (already installed, same ESM dynamic import pattern used in `McpClientService`).
- **Build verify after each task:** `pnpm build` (connector-service) must pass. `connector-service` tests: `pnpm test`.
- **Sync rule for Task 4 (admin UI):** web + Flutter must be in parity — use `orchestrate-feature`.

All paths relative to `apps/server/connector-service/src/`.

---

## Task 1 — BotSession schema + token service

Create the MongoDB collection and the service that issues, validates, and revokes bot session tokens.

**Files:**
- Create: `bot/bot-session.schema.ts`
- Create: `bot/bot-session.service.ts`
- Create: `bot/bot-session.service.spec.ts`
- Create: `bot/bot.module.ts`
- Modify: `app.module.ts` (import BotModule)

**Interfaces produced:**
- `BotSession` document: `{ id, userId, botUserId, tokenHash (SHA-256 hex), createdAt, lastUsedAt?, revokedAt? }`
- `BotSessionService.issue(userId, botUserId): string` — creates (or replaces) a session, returns **plaintext token once** (never stored).
- `BotSessionService.validate(token): { userId: string; botUserId: string } | null` — validates token, updates `lastUsedAt`, returns null if invalid/revoked.
- `BotSessionService.revoke(userId, botUserId): void` — soft-deletes by setting `revokedAt`.
- `BotSessionService.findForUser(userId): BotSession[]` — list active sessions.

- [ ] **Step 1 — Write failing tests**

Create `bot/bot-session.service.spec.ts`:

```ts
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { BotSessionService } from './bot-session.service';
import { BotSession } from './bot-session.schema';

const mockModel = () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
});

describe('BotSessionService', () => {
  let service: BotSessionService;
  let model: ReturnType<typeof mockModel>;

  beforeEach(async () => {
    model = mockModel();
    const module = await Test.createTestingModule({
      providers: [
        BotSessionService,
        { provide: getModelToken(BotSession.name), useValue: model },
      ],
    }).compile();
    service = module.get(BotSessionService);
  });

  it('issue() returns a 32-byte hex token and stores its SHA-256 hash', async () => {
    model.findOneAndUpdate.mockResolvedValue({ userId: 'u1', botUserId: 'extbot:b1' });
    const token = await service.issue('u1', 'extbot:b1');
    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    const [call] = model.findOneAndUpdate.mock.calls;
    const hash = createHash('sha256').update(token).digest('hex');
    expect(call[1].$set.tokenHash).toBe(hash);
  });

  it('validate() returns userId+botUserId for a valid token', async () => {
    const token = 'a'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');
    model.findOne.mockResolvedValue({ userId: 'u1', botUserId: 'extbot:b1', tokenHash: hash });
    const result = await service.validate(token);
    expect(result).toEqual({ userId: 'u1', botUserId: 'extbot:b1' });
  });

  it('validate() returns null for unknown token', async () => {
    model.findOne.mockResolvedValue(null);
    expect(await service.validate('bad')).toBeNull();
  });

  it('revoke() sets revokedAt', async () => {
    model.updateOne.mockResolvedValue({});
    await service.revoke('u1', 'extbot:b1');
    expect(model.updateOne).toHaveBeenCalledWith(
      { userId: 'u1', botUserId: 'extbot:b1', revokedAt: null },
      expect.objectContaining({ $set: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
  });
});
```

Run: `pnpm test -- --testPathPattern=bot-session.service` → FAIL (files don't exist yet).

- [ ] **Step 2 — Create `bot/bot-session.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BotSessionDocument = BotSession & Document;

/**
 * Maps a Bot Factory bot identity to a PON member. The plaintext token is
 * never stored — only its SHA-256 hash so a DB breach cannot replay tokens.
 * One active session per (userId, botUserId) pair; issuing a new token revokes
 * the previous one automatically (findOneAndUpdate with upsert).
 */
@Schema({ collection: 'bot_sessions', timestamps: true })
export class BotSession {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true }) botUserId: string;

  /** SHA-256 hex of the plaintext token. Indexed for O(1) lookup on every request. */
  @Prop({ required: true, index: true }) tokenHash: string;

  /** Nullable — set on revoke(). Active sessions have revokedAt: null. */
  @Prop({ default: null }) revokedAt: Date | null;

  @Prop() lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const BotSessionSchema = SchemaFactory.createForClass(BotSession);
// Compound index: only one active session per (userId, botUserId)
BotSessionSchema.index({ userId: 1, botUserId: 1 });
```

- [ ] **Step 3 — Create `bot/bot-session.service.ts`**

```ts
import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotSession, BotSessionDocument } from './bot-session.schema';

@Injectable()
export class BotSessionService {
  private readonly logger = new Logger(BotSessionService.name);

  constructor(
    @InjectModel(BotSession.name)
    private readonly model: Model<BotSessionDocument>,
  ) {}

  /**
   * Issues (or replaces) a bot session for the given (userId, botUserId) pair.
   * Returns the plaintext 32-byte token as a 64-char hex string — shown once,
   * never stored. Previous sessions for the same pair are superseded.
   */
  async issue(userId: string, botUserId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.model.findOneAndUpdate(
      { userId, botUserId },
      { $set: { tokenHash, revokedAt: null, lastUsedAt: null } },
      { upsert: true, new: true },
    );
    this.logger.log(`Issued bot session for userId=${userId} botUserId=${botUserId}`);
    return token;
  }

  /**
   * Validates a plaintext token. Returns the resolved identity or null when
   * the token is unknown or revoked. Updates lastUsedAt on success.
   */
  async validate(token: string): Promise<{ userId: string; botUserId: string } | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.model
      .findOne({ tokenHash, revokedAt: null })
      .lean();
    if (!session) return null;
    // Fire-and-forget lastUsedAt update — don't block the request
    this.model
      .updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {/* non-critical */});
    return { userId: session.userId, botUserId: session.botUserId };
  }

  /** Soft-revokes the active session for this (userId, botUserId) pair. */
  async revoke(userId: string, botUserId: string): Promise<void> {
    await this.model.updateOne(
      { userId, botUserId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Lists all active sessions for a user (for admin display). */
  async findForUser(userId: string): Promise<BotSession[]> {
    return this.model.find({ userId, revokedAt: null }).lean();
  }
}
```

- [ ] **Step 4 — Create `bot/bot.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotSession, BotSessionSchema } from './bot-session.schema';
import { BotSessionService } from './bot-session.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotSession.name, schema: BotSessionSchema }]),
  ],
  providers: [BotSessionService],
  exports: [BotSessionService],
})
export class BotModule {}
```

- [ ] **Step 5 — Register in `app.module.ts`**

Add `BotModule` to the `imports` array in `app.module.ts` (alongside `InternalModule`).

- [ ] **Step 6 — Run tests**

`pnpm test -- --testPathPattern=bot-session.service` → all 4 tests PASS.

- [ ] **Step 7 — Build verify**

`pnpm build` → must pass with no TypeScript errors.

- [ ] **Step 8 — Commit**

```bash
git add apps/server/connector-service/src/bot/ \
        apps/server/connector-service/src/app.module.ts
git commit -m "feat(connector): bot session token schema + service

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2 — MCP server endpoint in connector-service

Expose a Streamable HTTP MCP server endpoint at `POST /mcp` that Bot Factory can call with a bearer bot session token. Internally delegates to the existing `InternalService.getTools()` / `callTool()`.

**Files:**
- Create: `bot/bot-session.guard.ts`
- Create: `bot/mcp-server.controller.ts`
- Create: `bot/mcp-server.controller.spec.ts`
- Modify: `bot/bot.module.ts` (add controller + InternalModule dep)
- Modify: `internal/internal.module.ts` (export InternalService)

**Interfaces produced:**
- `BotSessionGuard` — NestJS guard that reads `Authorization: Bearer <token>` header, calls `BotSessionService.validate()`, attaches `{ userId, botUserId }` to `request.botSession`. Returns 401 on invalid token.
- `McpServerController` — `POST /mcp` — handles MCP Streamable HTTP protocol. On `initialize` request: responds with server capabilities. On `tools/list` request: returns `InternalService.getTools(userId)` formatted as MCP tools. On `tools/call` request: calls `InternalService.callTool(userId, name, input)` and returns MCP result.

- [ ] **Step 1 — Write failing test**

Create `bot/mcp-server.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BotSessionGuard } from './bot-session.guard';
import { McpServerController } from './mcp-server.controller';
import { BotSessionService } from './bot-session.service';
import { InternalService } from '../internal/internal.service';

const mockBotSessionService = { validate: jest.fn() };
const mockInternalService = { getTools: jest.fn(), callTool: jest.fn() };

describe('McpServerController', () => {
  let controller: McpServerController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [McpServerController],
      providers: [
        { provide: BotSessionService, useValue: mockBotSessionService },
        { provide: InternalService, useValue: mockInternalService },
      ],
    })
      .overrideGuard(BotSessionGuard)
      .useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().botSession = { userId: 'u1', botUserId: 'extbot:b1' };
        return true;
      }})
      .compile();
    controller = module.get(McpServerController);
  });

  it('handles tools/list and returns user tools', async () => {
    mockInternalService.getTools.mockResolvedValue({
      tools: [{ name: 'mcp__gmail__send', description: 'Send email', input_schema: {} }],
    });
    const req = { body: { method: 'tools/list', params: {} }, botSession: { userId: 'u1' } } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    await controller.handle(req, res);
    expect(mockInternalService.getTools).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ tools: expect.any(Array) }) }),
    );
  });

  it('handles tools/call and returns result', async () => {
    mockInternalService.callTool.mockResolvedValue({ result: 'email sent' });
    const req = {
      body: { method: 'tools/call', params: { name: 'mcp__gmail__send', arguments: { to: 'a@b.com' } } },
      botSession: { userId: 'u1' },
    } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    await controller.handle(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({ content: expect.any(Array) }),
      }),
    );
  });
});
```

Run: `pnpm test -- --testPathPattern=mcp-server.controller` → FAIL.

- [ ] **Step 2 — Create `bot/bot-session.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BotSessionService } from './bot-session.service';

/**
 * Validates the bearer token on MCP endpoint requests.
 * Attaches `request.botSession = { userId, botUserId }` on success.
 */
@Injectable()
export class BotSessionGuard implements CanActivate {
  constructor(private readonly sessions: BotSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers?.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException('Invalid or revoked token');
    req.botSession = session;
    return true;
  }
}
```

- [ ] **Step 3 — Create `bot/mcp-server.controller.ts`**

```ts
import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BotSessionGuard } from './bot-session.guard';
import { InternalService } from '../internal/internal.service';

/**
 * MCP Streamable HTTP server endpoint consumed by Bot Factory personal
 * assistant bots. Speaks a simplified MCP JSON-RPC protocol (initialize,
 * tools/list, tools/call). Auth: Bearer bot session token.
 *
 * Bot Factory adds this as a custom HTTP MCP server:
 *   URL:  https://<pon-host>/mcp
 *   Auth: Bearer <botSessionToken>
 */
@ApiTags('mcp-server')
@Controller('mcp')
@UseGuards(BotSessionGuard)
export class McpServerController {
  constructor(private readonly internal: InternalService) {}

  @Post()
  async handle(@Req() req: Request & { botSession: { userId: string } }, @Res() res: Response) {
    const { method, id, params } = (req.body ?? {}) as {
      method?: string;
      id?: string | number;
      params?: Record<string, unknown>;
    };
    const userId = req.botSession.userId;

    try {
      const result = await this.dispatch(method ?? '', userId, params ?? {});
      return res.json({ jsonrpc: '2.0', id: id ?? null, result });
    } catch (err) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32603, message: (err as Error).message },
      });
    }
  }

  private async dispatch(
    method: string,
    userId: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pon-connector', version: '1.0.0' },
        };

      case 'tools/list': {
        const { tools } = await this.internal.getTools(userId);
        return {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.input_schema,
          })),
        };
      }

      case 'tools/call': {
        const name = params.name as string;
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        const { result } = await this.internal.callTool(userId, name, args);
        return { content: [{ type: 'text', text: result }] };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}
```

- [ ] **Step 4 — Export `InternalService` from `internal/internal.module.ts`**

In `internal/internal.module.ts`, add `InternalService` to the `exports` array so `BotModule` can inject it.

- [ ] **Step 5 — Update `bot/bot.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotSession, BotSessionSchema } from './bot-session.schema';
import { BotSessionService } from './bot-session.service';
import { BotSessionGuard } from './bot-session.guard';
import { McpServerController } from './mcp-server.controller';
import { InternalModule } from '../internal/internal.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotSession.name, schema: BotSessionSchema }]),
    InternalModule,
  ],
  controllers: [McpServerController],
  providers: [BotSessionService, BotSessionGuard],
  exports: [BotSessionService],
})
export class BotModule {}
```

- [ ] **Step 6 — Run tests**

`pnpm test -- --testPathPattern=bot-session|mcp-server` → all tests PASS.

- [ ] **Step 7 — Build verify**

`pnpm build` → must pass.

- [ ] **Step 8 — Commit**

```bash
git add apps/server/connector-service/src/bot/ \
        apps/server/connector-service/src/internal/internal.module.ts
git commit -m "feat(connector): MCP server endpoint for Bot Factory personal assistant

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3 — Token issuance REST API in connector-service

Admin-facing endpoint to issue/revoke bot session tokens. Protected by PON JWT + `PERM_MANAGE_WORKSPACE`.

**Files:**
- Create: `bot/bot-admin.controller.ts`
- Create: `bot/bot-admin.controller.spec.ts`
- Modify: `bot/bot.module.ts` (add controller)
- Modify: `app.module.ts` (add `MCP_SERVER_URL` to config — base URL returned to admin so they know where to point Bot Factory)
- Modify: `config/configuration.ts` (add `mcpServerUrl`)

**Interfaces produced:**
- `POST /api/bot/sessions` body `{ userId, botUserId }` → `{ token: string, mcpUrl: string }` — requires `PERM_MANAGE_WORKSPACE`. Returns token **once**.
- `DELETE /api/bot/sessions` body `{ userId, botUserId }` → `204` — requires `PERM_MANAGE_WORKSPACE`.
- `GET /api/bot/sessions?userId=<id>` → `{ sessions: [{ botUserId, createdAt, lastUsedAt }] }` — requires `PERM_MANAGE_WORKSPACE`. Token hashes are never returned.

- [ ] **Step 1 — Add `mcpServerUrl` to config**

In `config/configuration.ts`, add to the returned object:
```ts
mcpServerUrl: process.env.MCP_SERVER_URL ?? 'http://localhost:3003/mcp',
```

- [ ] **Step 2 — Create `bot/bot-admin.controller.ts`**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RequirePermission, Capability } from '@platform/database';
import { BotSessionService } from './bot-session.service';

class BotSessionDto {
  userId: string;
  botUserId: string;
}

@ApiTags('bot-admin')
@UseGuards(JwtAuthGuard)
@Controller('api/bot')
export class BotAdminController {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a bot session token. Returns the plaintext token once — admin must
   * copy it immediately and configure it in Bot Factory as the MCP Bearer token.
   */
  @Post('sessions')
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async issue(@Body() dto: BotSessionDto) {
    const token = await this.sessions.issue(dto.userId, dto.botUserId);
    const mcpUrl = this.config.get<string>('mcpServerUrl');
    return { token, mcpUrl };
  }

  /** Revoke a bot session — the Bot Factory bot loses tool access immediately. */
  @Delete('sessions')
  @HttpCode(204)
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async revoke(@Body() dto: BotSessionDto) {
    await this.sessions.revoke(dto.userId, dto.botUserId);
  }

  /** List active bot sessions for a user (token hashes never returned). */
  @Get('sessions')
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async list(@Query('userId') userId: string) {
    const sessions = await this.sessions.findForUser(userId);
    return {
      sessions: sessions.map((s) => ({
        botUserId: s.botUserId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt ?? null,
      })),
    };
  }
}
```

- [ ] **Step 3 — Add controller to `bot/bot.module.ts`**

Add `BotAdminController` to the `controllers` array in `bot.module.ts`.

- [ ] **Step 4 — Build verify + tests**

`pnpm build` → pass. `pnpm test` → all existing + new tests pass.

- [ ] **Step 5 — Commit**

```bash
git add apps/server/connector-service/src/bot/bot-admin.controller.ts \
        apps/server/connector-service/src/bot/bot.module.ts \
        apps/server/connector-service/src/config/configuration.ts
git commit -m "feat(connector): admin API to issue/revoke bot session tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4 — Admin UI: generate & display integration token (Web + Flutter)

Admin can go to the "Personal Assistants" section in the admin panel, select a registered bot, and generate the integration token + MCP URL — then copy them into Bot Factory. Must satisfy `sync.md` (web + Flutter parity). Use `superpowers:orchestrate-feature`.

**Files:**
- Create: `apps/web/lib/api/bot-admin.ts` — typed client for `POST/DELETE/GET /api/bot/sessions` (via `connectorApi` axios instance since this lives in connector-service).
- Create: `apps/web/components/admin/BotIntegrationPanel.tsx` — shows registered bots (from existing `GET /api/admin/external-bots` on chat-service), "Generate Token" button per bot → shows copyable token + MCP URL in a one-time modal, "Revoke" button.
- Modify: `apps/web/app/(main)/admin/ai/page.tsx` — embed `BotIntegrationPanel`.
- Create: `apps/client/lib/features/admin/data/bot_admin_repository.dart`
- Create: `apps/client/lib/features/admin/ui/bot_integration_panel.dart`
- Modify: `apps/client/lib/features/admin/ui/admin_screen.dart` — add Bot Integration tab (gated by `MANAGE_WORKSPACE`).
- i18n: `apps/web/messages/*.json` + `apps/client/lib/l10n/app_*.arb` (all 7 locales each).

**Key UX rules:**
- Token is shown **once** in a modal/dialog with a "Copy" button and a warning: "Save this token — it cannot be retrieved again." After dismissing, only "Revoke & regenerate" is available.
- `lastUsedAt` is displayed so admin can see if Bot Factory is actually calling the endpoint.
- Capability gate: `MANAGE_WORKSPACE` (same as other admin panels). Non-admin members never see this UI.
- `mcpUrl` is displayed alongside the token so admin knows exactly what URL to enter in Bot Factory.

**i18n keys to add:**
```
botAdmin.title, botAdmin.generateToken, botAdmin.revokeToken,
botAdmin.tokenWarning, botAdmin.copyToken, botAdmin.mcpUrl,
botAdmin.lastUsed, botAdmin.neverUsed, botAdmin.noBotsRegistered
```

---

## Manual end-to-end verification (after all tasks)

1. Login as workspace admin in PON → Admin panel → AI tab.
2. See registered bots (from Phase 1 bridge). Click "Generate token" for a member's bot.
3. Copy the token + MCP URL shown in the modal.
4. In Bot Factory UI for that bot → add custom MCP server: URL = `<mcpUrl>`, Auth = Bearer `<token>`.
5. Bot Factory bot now shows `mcp__gmail__*`, `mcp__calendar__*` tools.
6. Send a message to the personal assistant: "Tóm tắt email chưa đọc hôm nay" → assistant calls `mcp__gmail__search` → returns summary.
7. Revoke the token in PON admin → Bot Factory immediately loses tool access (next call returns 401).

---

## Out of scope (follow-up)

- Auto-provisioning bot session tokens when a bot is first registered (Phase 4).
- Token rotation / expiry policy.
- Per-tool permission scoping (currently inherits full connector-service RBAC).
