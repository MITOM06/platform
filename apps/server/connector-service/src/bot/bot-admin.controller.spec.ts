import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RequirePermissionGuard } from '@platform/database';
import { BotAdminController } from './bot-admin.controller';
import { BotSessionService } from './bot-session.service';

const mockSessions = {
  issue: jest.fn(),
  revoke: jest.fn(),
  findForUser: jest.fn(),
};
const mockConfig = { get: jest.fn().mockReturnValue('http://localhost:3003/mcp') };

describe('BotAdminController', () => {
  let controller: BotAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BotAdminController],
      providers: [
        { provide: BotSessionService, useValue: mockSessions },
        { provide: ConfigService, useValue: mockConfig },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequirePermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(BotAdminController);
  });

  it('issue() returns the token once plus the MCP URL', async () => {
    mockSessions.issue.mockResolvedValue('tok123');
    const res = await controller.issue({ userId: 'u1', botUserId: 'extbot:b1' });
    expect(mockSessions.issue).toHaveBeenCalledWith('u1', 'extbot:b1');
    expect(res).toEqual({ token: 'tok123', mcpUrl: 'http://localhost:3003/mcp' });
  });

  it('revoke() delegates to the service', async () => {
    mockSessions.revoke.mockResolvedValue(undefined);
    await controller.revoke({ userId: 'u1', botUserId: 'extbot:b1' });
    expect(mockSessions.revoke).toHaveBeenCalledWith('u1', 'extbot:b1');
  });

  it('list() never leaks token hashes', async () => {
    mockSessions.findForUser.mockResolvedValue([
      {
        botUserId: 'extbot:b1',
        tokenHash: 'SECRET_HASH',
        createdAt: new Date('2026-06-25'),
        lastUsedAt: null,
      },
    ]);
    const res = await controller.list('u1');
    expect(JSON.stringify(res)).not.toContain('SECRET_HASH');
    expect(res.sessions[0]).toEqual({
      botUserId: 'extbot:b1',
      createdAt: new Date('2026-06-25'),
      lastUsedAt: null,
    });
  });
});
