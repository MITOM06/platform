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
    expect(mockInternalService.getTools).toHaveBeenCalledWith('u1', 'bot');
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

  it('refuses a write with a JSON-RPC error carrying SENSITIVE_ACTION_REQUIRES_CONFIRMATION', async () => {
    mockInternalService.callTool.mockResolvedValue({
      result: 'Tool error: [NOT_PERMITTED] needs confirmation',
      refusal: 'SENSITIVE_ACTION_REQUIRES_CONFIRMATION',
    });
    const req = {
      body: { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'mcp__gmail__send_email', arguments: {} } },
      botSession: { userId: 'u1' },
    } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    await controller.handle(req, res);
    expect(mockInternalService.callTool).toHaveBeenCalledWith('u1', 'mcp__gmail__send_email', {}, 'bot');
    const body = res.json.mock.calls[0][0];
    expect(body.error).toEqual({
      code: -32010,
      message: 'SENSITIVE_ACTION_REQUIRES_CONFIRMATION',
      data: expect.objectContaining({ code: 'SENSITIVE_ACTION_REQUIRES_CONFIRMATION', tool: 'mcp__gmail__send_email' }),
    });
  });

  it('acknowledges notifications with 202 and hides internal error text', async () => {
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), end: jest.fn() } as any;
    await controller.handle({ body: { method: 'notifications/initialized' }, botSession: { userId: 'u1' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(202);

    mockInternalService.getTools.mockRejectedValue(new Error('mongo at 10.0.0.3 refused'));
    const res2 = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    await controller.handle({ body: { id: 1, method: 'tools/list' }, botSession: { userId: 'u1' } } as any, res2);
    expect(res2.json.mock.calls[0][0].error).toEqual({ code: -32603, message: 'Internal error' });
  });
});
