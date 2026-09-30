import { ConfigService } from '@nestjs/config';
import { KbProcessorService } from './kb-processor.service';

function makeService(internalUrl?: string): KbProcessorService {
  const config = {
    get: jest.fn((k: string) => (k === 'config.chat.internalUrl' ? internalUrl : undefined)),
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
