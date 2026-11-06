import { ConfigService } from '@nestjs/config';
import { MeetingRecordClient } from './meeting-record.client';

const make = (key?: string) =>
  new MeetingRecordClient({
    get: (k: string) => (k === 'config.chat.internalUrl' ? 'http://chat:8080/' : k === 'config.connector.internalApiKey' ? key : undefined),
  } as unknown as ConfigService);

describe('MeetingRecordClient', () => {
  const orig = global.fetch;
  afterEach(() => { global.fetch = orig; });
  const mock = (status: number, body: unknown = {}) => {
    const f = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
    global.fetch = f as unknown as typeof fetch;
    return f;
  };

  it('GETs the encoded URL with the internal key', async () => {
    const f = mock(200, { meeting: { id: 'm' } });
    const out = await make('k').fetch('m/1', 'u 2');
    expect(out).toEqual({ meeting: { id: 'm' } });
    expect(f.mock.calls[0][0]).toBe('http://chat:8080/internal/meetings/m%2F1/record?userId=u%202');
    expect(f.mock.calls[0][1].headers).toEqual({ 'X-Internal-Key': 'k' });
    expect(f.mock.calls[0][1].redirect).toBe('error');
  });
  it('omits the header without a key', async () => {
    const f = mock(200);
    await make().fetch('m', 'u');
    expect(f.mock.calls[0][1].headers).toEqual({});
  });
  it('404 -> null', async () => {
    mock(404);
    expect(await make('k').fetch('m', 'u')).toBeNull();
  });
  it('401 and 5xx throw', async () => {
    mock(401);
    await expect(make('k').fetch('m', 'u')).rejects.toThrow();
    mock(503);
    await expect(make('k').fetch('m', 'u')).rejects.toThrow();
  });
  it('listMine GETs the list URL with userId/q/limit and the key; non-2xx throws', async () => {
    const f = mock(200, [{ id: 'm' }]);
    expect(await make('k').listMine('u 1', ' kế hoạch ')).toEqual([{ id: 'm' }]);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('http://chat:8080/internal/meetings');
    expect(url.searchParams.get('userId')).toBe('u 1');
    expect(url.searchParams.get('q')).toBe('kế hoạch');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(f.mock.calls[0][1].headers).toEqual({ 'X-Internal-Key': 'k' });
    expect(f.mock.calls[0][1].redirect).toBe('error');
    mock(503);
    await expect(make('k').listMine('u')).rejects.toThrow();
  });
});
