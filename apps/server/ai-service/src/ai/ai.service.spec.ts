import { ConfigService } from '@nestjs/config';
import { AiService, AiRequestPayload } from './ai.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';

function makeAsyncIterator(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const c of chunks) yield c;
    },
  };
}

function makeChunks(texts: string[]) {
  return makeAsyncIterator(
    texts.map((t) => ({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: t },
    })),
  );
}

function makeErrorStream() {
  return {
    [Symbol.asyncIterator]: async function* () {
      throw new Error('model overloaded');
      // eslint-disable-next-line no-unreachable
      yield; // required to make it an async generator
    },
  };
}

describe('AiService', () => {
  let service: AiService;
  let publish: jest.Mock;
  let mockStream: jest.Mock;

  const basePayload: AiRequestPayload = {
    conversationId: 'conv-test',
    userId: 'user-1',
    displayName: 'Alice',
    content: 'Hello AI',
    history: [],
  };

  beforeEach(() => {
    publish = jest.fn().mockResolvedValue(undefined);
    mockStream = jest.fn();

    const fakeConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          'config.anthropic.apiKey': 'test-key',
          'config.anthropic.model': 'test-primary',
          'config.anthropic.fallbackModel': 'test-fallback',
        };
        return map[key];
      }),
    } as unknown as ConfigService;

    const fakePublisher = { publish } as unknown as RedisPublisherService;

    service = new AiService(fakeConfig, fakePublisher);
    // Replace the real Anthropic client with a controlled mock
    (service as any)['anthropic'] = { messages: { stream: mockStream } };
  });

  afterEach(() => jest.clearAllMocks());

  it('publishes AI_STREAM_CHUNK for each delta then AI_STREAM_DONE', async () => {
    mockStream.mockReturnValue(makeChunks(['Hello', ' World']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_CHUNK',
      chunk: 'Hello',
    });
    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_CHUNK',
      chunk: ' World',
    });
    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_DONE',
      fullContent: 'Hello World',
    });
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR' }),
    );
  });

  it('retries fallback model when primary fails before any chunks', async () => {
    mockStream
      .mockReturnValueOnce(makeErrorStream())
      .mockReturnValueOnce(makeChunks(['Fallback reply']));

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_DONE',
      fullContent: 'Fallback reply',
    });
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR' }),
    );
  });

  it('publishes AI_STREAM_ERROR when both primary and fallback fail', async () => {
    mockStream.mockReturnValue(makeErrorStream());

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_ERROR',
      error: 'AI is temporarily unavailable.',
    });
  });
});
