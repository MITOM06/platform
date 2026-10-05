import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RequirePermissionGuard } from '@platform/database';
import { BotAdminController } from './bot-admin.controller';
import { BotSessionService } from './bot-session.service';
import { BotBridgeService } from './bot-bridge.service';
import { BotSessionDto } from './bot.dto';

const mockSessions = {
  issue: jest.fn(),
  revoke: jest.fn(),
  findForUser: jest.fn(),
  expiryOf: jest.fn().mockReturnValue(Date.parse('2026-12-01T00:00:00Z')),
};
const mockBridge = {
  requireMcpServerUrl: jest.fn().mockReturnValue('https://pon.example/api/connector/mcp'),
  assertIssuable: jest.fn().mockResolvedValue(undefined),
};

describe('BotAdminController', () => {
  let controller: BotAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BotAdminController],
      providers: [
        { provide: BotSessionService, useValue: mockSessions },
        { provide: BotBridgeService, useValue: mockBridge },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequirePermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(BotAdminController);
  });

  it('the DTO survives the global whitelist ValidationPipe (it used to be stripped to {})', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const meta = { type: 'body' as const, metatype: BotSessionDto };
    await expect(pipe.transform({ userId: 'u1', botUserId: 'extbot:b1' }, meta)).resolves.toMatchObject({
      userId: 'u1',
      botUserId: 'extbot:b1',
    });
    await expect(pipe.transform({ userId: { $ne: null }, botUserId: 'extbot:b1' }, meta)).rejects.toBeDefined();
    await expect(pipe.transform({}, meta)).rejects.toBeDefined();
  });

  it('issue() verifies the bot belongs to the member, then returns the token once', async () => {
    const expiresAt = new Date('2027-01-01');
    mockSessions.issue.mockResolvedValue({ token: 'tok123', expiresAt });
    const res = await controller.issue({ userId: 'u1', botUserId: 'extbot:b1' });
    expect(mockBridge.assertIssuable).toHaveBeenCalledWith('u1', 'extbot:b1');
    expect(mockSessions.issue).toHaveBeenCalledWith('u1', 'extbot:b1');
    expect(res).toEqual({ token: 'tok123', mcpUrl: 'https://pon.example/api/connector/mcp', expiresAt });
  });

  it('issue() does not mint a token when ownership fails', async () => {
    mockBridge.assertIssuable.mockRejectedValueOnce(new Error('BOT_OWNER_MISMATCH'));
    await expect(controller.issue({ userId: 'u1', botUserId: 'extbot:other' })).rejects.toThrow();
    expect(mockSessions.issue).not.toHaveBeenCalled();
  });

  it('revoke() delegates to the service', async () => {
    mockSessions.revoke.mockResolvedValue(undefined);
    await controller.revoke({ userId: 'u1', botUserId: 'extbot:b1' });
    expect(mockSessions.revoke).toHaveBeenCalledWith('u1', 'extbot:b1');
  });

  it('list() never leaks token hashes and reports the expiry', async () => {
    mockSessions.findForUser.mockResolvedValue([
      { botUserId: 'extbot:b1', tokenHash: 'SECRET_HASH', createdAt: new Date('2026-06-25'), lastUsedAt: null },
    ]);
    const res = await controller.list({ userId: 'u1' });
    expect(JSON.stringify(res)).not.toContain('SECRET_HASH');
    expect(res.sessions[0]).toEqual({
      botUserId: 'extbot:b1',
      createdAt: new Date('2026-06-25'),
      lastUsedAt: null,
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });
  });
});
