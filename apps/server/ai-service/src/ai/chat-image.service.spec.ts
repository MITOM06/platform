import { ConfigService } from '@nestjs/config';
import { ChatImageService } from './chat-image.service';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.chat.visionEnabled': true,
    'config.chat.internalUrl': 'http://chat:8080',
    'config.chat.visionMaxImages': 4,
    'config.chat.visionMaxImageBytes': 5_000_000,
    ...overrides,
  };
  return { get: jest.fn().mockImplementation((k: string) => map[k]) } as unknown as ConfigService;
}

function mockFetchOnce(opts: { ok?: boolean; status?: number; contentType?: string; body?: Buffer }) {
  const body = opts.body ?? Buffer.from('imgbytes');
  return jest.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: () => opts.contentType ?? 'image/png' },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

describe('ChatImageService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns [] when disabled (CHAT_VISION_ENABLED=false) without fetching', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionEnabled': false }));
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(svc.isEnabled()).toBe(false);
    expect(await svc.resolveImageBlocks(['/api/uploads/1'])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves a relative ref against the chat base and returns a base64 image block', async () => {
    const svc = new ChatImageService(makeConfig());
    const fetchMock = mockFetchOnce({ contentType: 'image/png', body: Buffer.from('abc') });
    global.fetch = fetchMock as unknown as typeof fetch;

    const blocks = await svc.resolveImageBlocks(['/api/uploads/665f']);
    expect(fetchMock).toHaveBeenCalledWith('http://chat:8080/api/uploads/665f');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from('abc').toString('base64'),
      },
    });
  });

  it('skips an unsupported media type (heic) fail-soft', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = mockFetchOnce({ contentType: 'image/heic' }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks(['/api/uploads/x.heic'])).toEqual([]);
  });

  it('skips an oversized image fail-soft', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionMaxImageBytes': 3 }));
    global.fetch = mockFetchOnce({
      contentType: 'image/png',
      body: Buffer.from('toolong'),
    }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks(['/api/uploads/big'])).toEqual([]);
  });

  it('skips a 404 fetch fail-soft', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = mockFetchOnce({ ok: false, status: 404 }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks(['/api/uploads/missing'])).toEqual([]);
  });

  it('caps the number of images at CHAT_VISION_MAX_IMAGES', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionMaxImages': 2 }));
    const fetchMock = mockFetchOnce({ contentType: 'image/png' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const blocks = await svc.resolveImageBlocks(['/a', '/b', '/c', '/d']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(blocks).toHaveLength(2);
  });

  it('infers media type from the URL extension when Content-Type is empty', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = mockFetchOnce({ contentType: '' }) as unknown as typeof fetch;
    const blocks = await svc.resolveImageBlocks(['/api/uploads/photo.jpg']);
    expect(blocks[0].source).toMatchObject({ media_type: 'image/jpeg' });
  });
});
