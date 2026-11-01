import { ConfigService } from '@nestjs/config';
import { AgenticLoopService } from './agentic-loop.service';
import { RequestContext } from './ai.types';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { ToolRoundRunner } from './tool-round.runner';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolContext } from '../tools/tool.interface';

/** C-9: a Member asks to send an email with Gmail connected — the role, not the connection, is why. */
describe('AgenticLoopService.prepare — role-withheld connector actions', () => {
  const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
  const ctx: RequestContext = {
    conversationId: 'conv-1',
    userId: 'alice',
    displayName: 'Alice',
    perms: [],
    departmentIds: [],
    baseSystem: 'You are PON AI.',
    volatileSystem: 'Today is Monday.',
    ragSources: [],
    responseCacheable: false,
    settings: {
      personaName: null,
      defaultTone: null,
      modelTier: 'auto',
      webSearchEnabled: true,
      thinkingEnabled: false,
      monthlyTokenLimit: 500000,
      allowedConnectors: null,
      dailyDigestEnabled: false,
      dailyDigestHour: 8,
    },
  };

  const loopWith = (withheld: string[]) => {
    const getDefinitions = jest.fn(async (toolCtx: ToolContext) => {
      toolCtx.withheldSink?.push(...withheld);
      return [];
    });
    const registry = { getDefinitions, execute: jest.fn() } as unknown as ToolRegistryService;
    return new AgenticLoopService(
      config,
      registry,
      { store: jest.fn() } as unknown as ResponseCacheService,
      { resolveImageBlocks: jest.fn().mockResolvedValue([]) } as unknown as ChatImageService,
      {} as ToolRoundRunner,
    );
  };

  it('tells the model which actions the role withholds, after the cached part of the prompt', async () => {
    const state = await loopWith(['mcp__gmail__send_email']).prepare(ctx, 'Send bob an email', []);
    expect(state.system[0].text).toBe('You are PON AI.'); // cached block untouched
    expect(state.system[1].text).toContain('Today is Monday.');
    expect(state.system[1].text).toContain('Gmail (send_email)');
    expect(state.system[1].text).toMatch(/role does not allow it/);
  });

  it('adds nothing when the role withholds nothing', async () => {
    const state = await loopWith([]).prepare(ctx, 'Hi', []);
    expect(state.system.map((b) => b.text)).toEqual(['You are PON AI.', 'Today is Monday.']);
  });
});
