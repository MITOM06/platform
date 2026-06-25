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
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().botSession = {
            userId: 'u1',
            botUserId: 'extbot:b1',
          };
          return true;
        },
      })
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
