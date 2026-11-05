import { ConfigService } from '@nestjs/config';
import { KbProcessorService } from './kb-processor.service';

function makeService(internalUrl?: string, key?: string): KbProcessorService {
  const config = {
    get: jest.fn((k: string) =>
      k === 'config.chat.internalUrl' ? internalUrl : k === 'config.connector.internalApiKey' ? key : undefined,
    ),
  } as unknown as ConfigService;
  return new KbProcessorService(
    {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, config,
  );
}

function toFetchUrl(service: KbProcessorService, fileUrl: string): string {
  return (service as unknown as { toFetchUrl: (u: string) => string }).toFetchUrl(fileUrl);
}

describe('KbProcessorService.toFetchUrl', () => {
  it('resolves the relative upload path clients send against chat-service', () => {
    const service = makeService('http://chat-service:8080/');
    expect(toFetchUrl(service, '/api/uploads/cbaed93e-94d9-4d14-8779-76aa67ba31f5')).toBe(
      'http://chat-service:8080/api/uploads/cbaed93e-94d9-4d14-8779-76aa67ba31f5',
    );
  });

  it('produces a URL Node fetch can parse (was: "Failed to parse URL")', () => {
    const url = toFetchUrl(makeService('http://chat-service:8080'), '/api/uploads/abc123');
    expect(() => new URL(url)).not.toThrow();
  });

  it('leaves an absolute URL untouched', () => {
    const abs = 'https://files.example.com/api/uploads/abc123';
    expect(toFetchUrl(makeService('http://chat-service:8080'), abs)).toBe(abs);
  });

  it('falls back to localhost:8080 when CHAT_INTERNAL_URL is unset (source dev)', () => {
    expect(toFetchUrl(makeService(undefined), '/api/uploads/abc123')).toBe(
      'http://localhost:8080/api/uploads/abc123',
    );
  });
});

describe('KbProcessorService X-Internal-Key on upload fetch', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function run(fileUrl: string, key = 'test-key') {
    const fetchMock = jest.fn().mockRejectedValue(new Error('stop'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const model = { findOneAndUpdate: jest.fn().mockReturnValue(Object.assign(Promise.resolve({}), { catch: () => Promise.resolve() })) };
    const publisher = { publishToChannel: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: jest.fn((k: string) =>
        k === 'config.chat.internalUrl' ? 'http://chat-service:8080' : k === 'config.connector.internalApiKey' ? key : undefined,
      ),
    } as unknown as ConfigService;
    const svc = new KbProcessorService(
      model as never, {} as never, {} as never, {} as never, {} as never, {} as never, publisher as never, config,
    );
    await svc.processDocument({ documentId: 'd', conversationId: 'c', userId: 'u', fileUrl, mimeType: 'text/plain', fileName: 'f' } as never);
    return fetchMock;
  }

  it('sends the key for a relative upload path (internal chat base)', async () => {
    const f = await run('/api/uploads/abc123');
    expect(f.mock.calls[0][0]).toBe('http://chat-service:8080/api/uploads/abc123');
    expect(f.mock.calls[0][1]).toEqual({ headers: { 'X-Internal-Key': 'test-key' }, redirect: 'error' });
  });

  it('sends the key for an absolute URL on the internal chat origin', async () => {
    const f = await run('http://chat-service:8080/api/uploads/abc123');
    expect(f.mock.calls[0][1]).toEqual({ headers: { 'X-Internal-Key': 'test-key' }, redirect: 'error' });
  });

  it('NEVER sends the key to an external absolute URL', async () => {
    const f = await run('https://files.example.com/api/uploads/abc123');
    expect(f.mock.calls[0][0]).toBe('https://files.example.com/api/uploads/abc123');
    expect(f.mock.calls[0][1]).toEqual({ headers: {}, redirect: 'error' });
  });
});
