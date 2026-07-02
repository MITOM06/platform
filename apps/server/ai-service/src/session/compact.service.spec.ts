import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AiSession } from '@platform/database';
import { CompactService, COMPACT_THRESHOLD_TOKENS } from './compact.service';
import { ClaudeClientService } from './claude-client.service';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

function makeSession(messages: Turn[], summary: string | null = null) {
  return {
    _id: 'sess-1',
    messages,
    summary,
    totalTokens: COMPACT_THRESHOLD_TOKENS + 1, // force compaction
  } as unknown as import('@platform/database').AiSessionDocument;
}

describe('CompactService', () => {
  let service: CompactService;
  let updateOne: jest.Mock;
  let findById: jest.Mock;
  let summarize: jest.Mock;

  beforeEach(async () => {
    updateOne = jest.fn().mockResolvedValue(undefined);
    // findById is called after the write to return the reloaded doc; echo a stub.
    findById = jest.fn().mockResolvedValue({ _id: 'sess-1', messages: [], summary: null });
    summarize = jest.fn().mockResolvedValue('SUMMARY TEXT');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompactService,
        { provide: getModelToken(AiSession.name), useValue: { updateOne, findById } },
        { provide: ClaudeClientService, useValue: { summarize } },
      ],
    }).compile();

    service = module.get(CompactService);
  });

  afterEach(() => jest.clearAllMocks());

  function setValue(call: unknown[]): Record<string, unknown> {
    return (call[1] as { $set: Record<string, unknown> }).$set;
  }

  it('does not compact below the token threshold', async () => {
    const session = makeSession([{ role: 'user', content: 'hi', createdAt: new Date() }]);
    (session as unknown as { totalTokens: number }).totalTokens = 10;

    const result = await service.maybeCompact(session);

    expect(result.compacted).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('ensures the kept slice begins on a user turn (bug #2)', async () => {
    // 10 turns starting with assistant → the natural split index lands on an
    // assistant turn; the fix must advance it so the kept slice starts on user.
    const messages: Turn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'assistant' : 'user',
      content: `m${i}`,
      createdAt: new Date(),
    }));

    const result = await service.maybeCompact(makeSession(messages));

    expect(result.compacted).toBe(true);
    expect(summarize).toHaveBeenCalled();
    const set = setValue(updateOne.mock.calls[0]);
    const kept = set.messages as Turn[];
    expect(kept[0].role).toBe('user');
    expect(set.summary).toBe('SUMMARY TEXT');
  });

  it('falls back to safety trim (keeps recent, NO summary) when summary is empty (bug #6)', async () => {
    summarize.mockResolvedValue('   '); // whitespace-only → treated as failure
    const messages: Turn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
      createdAt: new Date(),
    }));

    const result = await service.maybeCompact(makeSession(messages));

    // Empty summary is NOT a compaction — recent turns kept, but no summary set,
    // so buildMessageHistory won't ignore a bogus empty summary and drop context.
    expect(result.compacted).toBe(false);
    const set = setValue(updateOne.mock.calls[0]);
    expect(set.messages).toBeDefined();
    expect('summary' in set).toBe(false);
  });

  it('sets a real summary and keeps recent turns on a successful compaction', async () => {
    const messages: Turn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
      createdAt: new Date(),
    }));

    const result = await service.maybeCompact(makeSession(messages));

    expect(result.compacted).toBe(true);
    const set = setValue(updateOne.mock.calls[0]);
    expect(set.summary).toBe('SUMMARY TEXT');
    expect((set.messages as Turn[]).length).toBeGreaterThan(0);
  });
});
