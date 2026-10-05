import { ConfigService } from '@nestjs/config';
import { ChatImageService, sniffImageMediaType } from './chat-image.service';
import { resolveUploadUrl } from '../common/upload-ref';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OBJ_ID = '6650a1b2c3d4e5f6a7b8c9d0';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.chat.visionEnabled': true,
    'config.chat.internalUrl': 'http://chat:8080',
    'config.chat.visionMaxImages': 4,
    'config.chat.visionMaxImageBytes': 5_000_000,
    'config.chat.visionFetchTimeoutMs': 1000,
    ...overrides,
  };
  return { get: jest.fn().mockImplementation((k: string) => map[k]) } as unknown as ConfigService;
}

function respond(body: Buffer | null, init: { status?: number; contentType?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.contentType !== undefined) headers['content-type'] = init.contentType;
  const payload = body ? new Uint8Array(body) : null;
  return jest.fn().mockImplementation(async () => new Response(payload, { status: init.status ?? 200, headers }));
}

describe('resolveUploadUrl (SSRF guard)', () => {
  it('re-anchors relative and absolute upload refs on the internal chat base', () => {
    expect(resolveUploadUrl(`/api/uploads/${ID}`, 'http://chat:8080/')).toBe(`http://chat:8080/api/uploads/${ID}`);
    expect(resolveUploadUrl(`https://pon.example/api/uploads/${OBJ_ID}?x=1`, 'http://chat:8080')).toBe(
      `http://chat:8080/api/uploads/${OBJ_ID}`,
    );
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://evil.example/cat.png',
    `//evil.example/api/uploads/${ID}`,
    '/api/uploads/../../admin',
    '/api/uploads/not-an-id',
    `file:///api/uploads/${ID}`,
    '',
  ])('rejects %s', (ref) => {
    expect(resolveUploadUrl(ref, 'http://chat:8080')).toBeNull();
  });
});

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
    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches only from the internal chat base and returns a base64 image block', async () => {
    const svc = new ChatImageService(makeConfig());
    const fetchMock = respond(Buffer.from('abc'), { contentType: 'image/png' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const blocks = await svc.resolveImageBlocks([`https://public.example/api/uploads/${ID}`]);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://chat:8080/api/uploads/${ID}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
    expect(blocks).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from('abc').toString('base64') } },
    ]);
  });

  it('never fetches a non-upload URL from history (blind SSRF)', async () => {
    const svc = new ChatImageService(makeConfig());
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks(['http://169.254.169.254/latest/meta-data/iam'])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips an unsupported media type (heic) fail-soft', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = respond(Buffer.from('heic'), { contentType: 'image/heic' }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
  });

  it('rejects a declared oversize Content-Length before reading the body', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionMaxImageBytes': 3 }));
    global.fetch = respond(Buffer.from('abc'), {
      contentType: 'image/png',
      headers: { 'content-length': '999999999' },
    }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
  });

  it('stops reading a body that streams past the byte cap', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionMaxImageBytes': 1024 }));
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(512));
      },
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(endless, { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as unknown as typeof fetch;

    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
    expect(pulled).toBeLessThan(10); // abandoned right after crossing 1 KB
  });

  it('times out a stalled fetch instead of hanging the request', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionFetchTimeoutMs': 20 }));
    global.fetch = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    ) as unknown as typeof fetch;

    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
  });

  it('skips a 404 fetch fail-soft', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = respond(null, { status: 404 }) as unknown as typeof fetch;
    expect(await svc.resolveImageBlocks([`/api/uploads/${ID}`])).toEqual([]);
  });

  it('caps the number of images at CHAT_VISION_MAX_IMAGES', async () => {
    const svc = new ChatImageService(makeConfig({ 'config.chat.visionMaxImages': 2 }));
    const fetchMock = respond(PNG, { contentType: 'image/png' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const blocks = await svc.resolveImageBlocks([ID, ID, ID, ID].map((i) => `/api/uploads/${i}`));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(blocks).toHaveLength(2);
  });

  it('sniffs the media type from magic bytes when Content-Type is missing', async () => {
    const svc = new ChatImageService(makeConfig());
    global.fetch = respond(PNG, { contentType: '' }) as unknown as typeof fetch;
    const blocks = await svc.resolveImageBlocks([`/api/uploads/${ID}`]);
    expect(blocks[0].source).toMatchObject({ media_type: 'image/png' });
    expect(sniffImageMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageMediaType(Buffer.from('plain text'))).toBeNull();
  });
});
