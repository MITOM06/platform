import { RememberFactTool } from './remember-fact.tool';
import { MemoryService } from '../memory/memory.service';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = {
  conversationId: 'conv-1',
  userId: 'user-1',
  displayName: 'Khang',
};

function makeMemory(
  overrides: Partial<{ getMemory: jest.Mock; addFacts: jest.Mock }> = {},
): { service: MemoryService; getMemory: jest.Mock; addFacts: jest.Mock } {
  const getMemory = overrides.getMemory ?? jest.fn().mockResolvedValue(null);
  const addFacts = overrides.addFacts ?? jest.fn().mockResolvedValue(1);
  const service = { getMemory, addFacts } as unknown as MemoryService;
  return { service, getMemory, addFacts };
}

describe('RememberFactTool', () => {
  it('returns an error and does not write when no facts are provided', async () => {
    const { service, addFacts } = makeMemory();
    const tool = new RememberFactTool(service);
    const result = await tool.execute({ facts: [] }, ctx);
    expect(result).toMatch(/Tool error/);
    expect(addFacts).not.toHaveBeenCalled();
  });

  it('ignores blank / non-string entries', async () => {
    const { service, addFacts } = makeMemory();
    const tool = new RememberFactTool(service);
    const result = await tool.execute({ facts: ['  ', '', 42, null] as unknown as string[] }, ctx);
    expect(result).toMatch(/Tool error/);
    expect(addFacts).not.toHaveBeenCalled();
  });

  it('persists facts via MemoryService.addFacts and confirms', async () => {
    const { service, addFacts } = makeMemory({ addFacts: jest.fn().mockResolvedValue(2) });
    const tool = new RememberFactTool(service);
    const result = await tool.execute(
      { facts: ['Name is Khang', 'Building the PON platform'] },
      ctx,
    );
    expect(addFacts).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
      ['Name is Khang', 'Building the PON platform'],
      '',
      0,
      'user-requested',
    );
    expect(result).toContain('Remembered 2 fact(s)');
    expect(result).toContain('Name is Khang');
  });

  it('preserves the existing summary and message count when writing', async () => {
    const { service, addFacts } = makeMemory({
      getMemory: jest.fn().mockResolvedValue({ summary: 'Prior summary', messageCount: 7 }),
    });
    const tool = new RememberFactTool(service);
    await tool.execute({ facts: ['Likes dark mode'] }, ctx);
    expect(addFacts).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
      ['Likes dark mode'],
      'Prior summary',
      7,
      'user-requested',
    );
  });

  it('reports failure (and tells the model not to claim it remembered) when nothing was stored', async () => {
    const { service } = makeMemory({ addFacts: jest.fn().mockResolvedValue(0) });
    const tool = new RememberFactTool(service);
    const result = await tool.execute({ facts: ['Name is Khang'] }, ctx);
    expect(result).toMatch(/Tool error/);
    expect(result).toMatch(/Do not claim/i);
  });
});
