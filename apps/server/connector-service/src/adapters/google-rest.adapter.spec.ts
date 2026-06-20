import { GoogleRestAdapter } from './google-rest.adapter';

describe('GoogleRestAdapter', () => {
  let adapter: GoogleRestAdapter;
  let vault: any;
  let cfg: any;
  let connModel: any;
  let fetchMock: jest.Mock;

  const gmailConn = {
    provider: 'gmail',
    _id: 'c1',
    encryptedTokens: { iv: 'i', tag: 't', data: 'd' },
  };
  const calConn = {
    provider: 'calendar',
    _id: 'c2',
    encryptedTokens: { iv: 'i', tag: 't', data: 'd' },
  };

  beforeEach(() => {
    vault = {
      decrypt: jest
        .fn()
        .mockReturnValue(
          JSON.stringify({ access_token: 'tok', refresh_token: 'r' }),
        ),
      encrypt: jest.fn().mockReturnValue({ iv: 'i', tag: 't', data: 'd' }),
    };
    cfg = {
      get: jest.fn().mockReturnValue({ clientId: 'id', clientSecret: 'sec' }),
    };
    connModel = { updateOne: jest.fn().mockResolvedValue({}) };
    adapter = new GoogleRestAdapter(vault, cfg, connModel);
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  it('lists the 3 gmail tools', async () => {
    const tools = await adapter.listTools({ provider: 'gmail' });
    expect(tools.map((t) => t.name)).toEqual([
      'send_email',
      'create_draft',
      'search_threads',
    ]);
  });

  it('lists the 3 calendar tools', async () => {
    const tools = await adapter.listTools({ provider: 'calendar' });
    expect(tools.map((t) => t.name)).toEqual([
      'list_events',
      'create_event',
      'suggest_time',
    ]);
  });

  it('send_email POSTs a base64url RFC-822 body with a bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const out = await adapter.callTool(gmailConn, 'send_email', {
      to: 'a@b.com',
      subject: 'Hi',
      body: 'Yo',
    });

    expect(out).toContain('a@b.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const sent = JSON.parse(init.body);
    const decoded = Buffer.from(sent.raw, 'base64url').toString('utf8');
    expect(decoded).toContain('To: a@b.com');
    expect(decoded).toContain('Subject: Hi');
  });

  it('create_event POSTs to the calendar events endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const out = await adapter.callTool(calConn, 'create_event', {
      summary: 'Sync',
      start: '2026-06-21T10:00:00Z',
      end: '2026-06-21T10:30:00Z',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    expect(init.method).toBe('POST');
    expect(out).toContain('Sync');
  });

  it('refreshes the access token on a 401 then retries once', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok2', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const out = await adapter.callTool(gmailConn, 'send_email', {
      to: 'a@b.com',
      subject: 'Hi',
      body: 'Yo',
    });

    expect(out).toContain('a@b.com');
    // call 0: 401, call 1: token refresh, call 2: retry with new token
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('https://oauth2.googleapis.com/token');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer tok2');
    expect(connModel.updateOne).toHaveBeenCalled();
  });
});
