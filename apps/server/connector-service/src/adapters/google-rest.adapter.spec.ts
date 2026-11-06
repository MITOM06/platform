import { GoogleRestAdapter } from './google-rest.adapter';
import { ToolExecutionError } from '../internal/tool-errors';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

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
    connModel = {
      updateOne: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      exists: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    };
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

  describe('revoke', () => {
    const others = (rows: Array<{ accountLabel?: string }>) =>
      connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });
    const gmail = { provider: 'gmail', userId: 'u1', _id: 'c1', accountLabel: 'Minh@Example.com' };

    it('revokes at Google when no other active Google connection exists', async () => {
      fetchMock.mockResolvedValue({ ok: true });
      await expect(adapter.revoke(gmail)).resolves.toBe('revoked');
      expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/revoke');
      expect(connModel.find.mock.calls[0][0]).toMatchObject({ _id: { $ne: 'c1' }, status: 'active' });
    });

    it("skips while another member's connection rides the same Google account", async () => {
      others([{ accountLabel: 'minh@example.com' }]);
      await expect(adapter.revoke(gmail)).resolves.toBe('skipped');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('revokes when the other active connections belong to different Google accounts', async () => {
      others([{ accountLabel: 'someone@else.com' }]);
      fetchMock.mockResolvedValue({ ok: true });
      await expect(adapter.revoke(gmail)).resolves.toBe('revoked');
    });

    it('treats an unknown account on either side as a possible shared grant', async () => {
      others([{}]);
      await expect(adapter.revoke(gmail)).resolves.toBe('skipped');
      others([{ accountLabel: 'someone@else.com' }]);
      await expect(adapter.revoke({ provider: 'gmail', userId: 'u1', _id: 'c1' })).resolves.toBe('skipped');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Helpers for the cases below ─────────────────────────────────────────
  const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
  const fail = (status: number, body = '') => ({ ok: false, status, json: async () => JSON.parse(body || '{}'), text: async () => body });
  const tokens = (t: Record<string, unknown>) => vault.decrypt.mockReturnValue(JSON.stringify(t));
  const caught = (p: Promise<unknown>) => p.then(() => { throw new Error('expected a rejection'); }, (e) => e);
  const silenceLogs = () => jest.spyOn((adapter as any).logger, 'warn').mockImplementation(() => undefined);

  describe('routing + input', () => {
    it('lists nothing and refuses calls for a non-Google provider', async () => {
      expect(await adapter.listTools({ provider: 'notion' })).toEqual([]);
      const err = await caught(adapter.callTool({ provider: 'notion' }, 'search', {}));
      expect(err).toBeInstanceOf(ToolExecutionError);
      expect(err).toMatchObject({ code: 'UNKNOWN_TOOL', message: 'Unsupported provider notion.' });
    });

    it.each([
      [gmailConn, 'delete_everything', 'Unknown Gmail tool delete_everything.'],
      [calConn, 'delete_event', 'Unknown calendar tool delete_event.'],
    ])('rejects an unknown tool on %#', async (conn, tool, msg) => {
      fetchMock.mockResolvedValue(ok());
      await expect(adapter.callTool(conn, tool, {})).rejects.toMatchObject({ code: 'UNKNOWN_TOOL', message: msg });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('maps a bad recipient to INVALID_INPUT without calling Google', async () => {
      const err = await caught(adapter.callTool(gmailConn, 'send_email', { to: 'a@b.com\r\nBcc: x@evil.com', subject: 's' }));
      expect(err).toMatchObject({ code: 'INVALID_INPUT' });
      expect(fetchMock).not.toHaveBeenCalled();
      await expect(adapter.callTool(gmailConn, 'create_draft', {})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('accepts a null input object', async () => {
      fetchMock.mockResolvedValue(ok({ items: [] }));
      expect(await adapter.callTool(calConn, 'list_events', null as any)).toBe('No events found in that time range.');
    });
  });

  describe('Gmail', () => {
    it('send_email reports the message id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'm-42' }));
      expect(await adapter.callTool(gmailConn, 'send_email', { to: 'a@b.com', subject: 's', body: 'b' })).toBe(
        'Email sent to a@b.com (message id: m-42).',
      );
    });

    it('send_email tolerates a non-JSON success body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
      expect(await adapter.callTool(gmailConn, 'send_email', { to: 'a@b.com' })).toBe('Email sent to a@b.com.');
    });

    it('create_draft POSTs { message: { raw } } to /drafts and reports the id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'd-1' }));
      expect(await adapter.callTool(gmailConn, 'create_draft', { to: 'a@b.com', subject: 's', body: 'b' })).toBe(
        'Draft created (draft id: d-1).',
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/drafts');
      expect(Object.keys(JSON.parse(init.body))).toEqual(['message']);
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('create_draft without an id in the answer', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('empty'); } });
      expect(await adapter.callTool(gmailConn, 'create_draft', { to: 'a@b.com' })).toBe('Draft created.');
    });

    it.each([
      ['send_email', 403, '{"error":{"errors":[{"reason":"insufficientPermissions"}],"message":"secret-ish detail"}}', 'PERMISSION_DENIED', 'Gmail denied access to this action (insufficientPermissions).'],
      ['create_draft', 429, '', 'RATE_LIMITED', 'Gmail is rate limiting requests; try again shortly.'],
      ['send_email', 500, '<html>oops</html>', 'UPSTREAM_UNAVAILABLE', 'Gmail is temporarily unavailable (HTTP 500).'],
      ['send_email', 400, '{"error":{"status":"INVALID_ARGUMENT"}}', 'UPSTREAM_ERROR', 'Gmail rejected the request (HTTP 400) (INVALID_ARGUMENT).'],
    ])('%s HTTP %i → %s with a clean message', async (tool, status, body, code, message) => {
      silenceLogs();
      fetchMock.mockResolvedValue(fail(status, body));
      const err = await caught(adapter.callTool(gmailConn, tool, { to: 'a@b.com' }));
      expect(err).toMatchObject({ code, message });
      expect(err.message).not.toContain('secret-ish');
    });

    it('a failure whose body cannot be read still maps cleanly', async () => {
      silenceLogs();
      fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => { throw new Error('stream'); } });
      await expect(adapter.callTool(gmailConn, 'send_email', { to: 'a@b.com' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Gmail could not find that item.',
      });
    });

    describe('search_threads', () => {
      it('lists, then fetches metadata per thread (ids URL-encoded, id-less dropped)', async () => {
        fetchMock
          .mockResolvedValueOnce(ok({ threads: [{ id: 't/1', snippet: 's1' }, { snippet: 'no id' }], resultSizeEstimate: 1 }))
          .mockResolvedValueOnce(ok({ id: 't/1', messages: [{ snippet: 'hello', payload: { headers: [{ name: 'Subject', value: 'Invoice' }] } }] }));
        const out = await adapter.callTool(gmailConn, 'search_threads', { query: 'invoice from:bank', maxResults: 5 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const listUrl = new URL(fetchMock.mock.calls[0][0]);
        expect(listUrl.searchParams.get('q')).toBe('invoice from:bank');
        expect(listUrl.searchParams.get('maxResults')).toBe('5');
        expect(fetchMock.mock.calls[0][1].method).toBe('GET');
        expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
        const detailUrl = fetchMock.mock.calls[1][0] as string;
        expect(detailUrl).toContain('/threads/t%2F1?format=metadata');
        expect(new URL(detailUrl).searchParams.getAll('metadataHeaders')).toEqual(['From', 'Subject', 'Date']);
        expect(out).toContain('Invoice');
      });

      it.each([
        [undefined, '10'],
        [0, '10'],
        ['abc', '10'],
        [3.9, '3'],
        [999, '10'],
      ])('clamps maxResults %p to %s', async (maxResults, expected) => {
        fetchMock.mockResolvedValue(ok({}));
        expect(await adapter.callTool(gmailConn, 'search_threads', { maxResults })).toBe('No email threads match "".');
        expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('maxResults')).toBe(expected);
      });

      it('falls back to the list snippet when one thread detail fails', async () => {
        fetchMock
          .mockResolvedValueOnce(ok({ threads: [{ id: 'a', snippet: 'fallback snippet' }] }))
          .mockResolvedValueOnce(fail(500));
        expect(await adapter.callTool(gmailConn, 'search_threads', { query: 'x' })).toContain('fallback snippet');
      });

      it('never shows more threads than the limit even if Google returns more', async () => {
        const threads = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}` }));
        fetchMock.mockResolvedValueOnce(ok({ threads })).mockResolvedValue(ok({ messages: [] }));
        await adapter.callTool(gmailConn, 'search_threads', { query: 'x', maxResults: 2 });
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      it('a failing listing is a coded error', async () => {
        silenceLogs();
        fetchMock.mockResolvedValue(fail(403, ''));
        await expect(adapter.callTool(gmailConn, 'search_threads', {})).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      });
    });
  });

  describe('Calendar', () => {
    it('create_event maps attendees to {email} and reports the id', async () => {
      fetchMock.mockResolvedValue(ok({ id: 'ev1' }));
      const out = await adapter.callTool(calConn, 'create_event', {
        summary: 'Sync',
        description: 'd',
        start: '2026-06-21T10:00:00Z',
        end: '2026-06-21T10:30:00Z',
        attendees: ['a@b.com', 42],
      });
      expect(out).toBe('Event "Sync" booked at 2026-06-21T10:00:00Z (event id: ev1).');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        summary: 'Sync',
        description: 'd',
        start: { dateTime: '2026-06-21T10:00:00Z' },
        end: { dateTime: '2026-06-21T10:30:00Z' },
        attendees: [{ email: 'a@b.com' }, { email: '42' }],
      });
    });

    it('create_event ignores a non-array attendees value and maps a failure', async () => {
      silenceLogs();
      fetchMock.mockResolvedValue(fail(401, ''));
      fetchMock.mockResolvedValueOnce(fail(401, '')).mockResolvedValueOnce(fail(400, '{"error":"invalid_request"}'));
      await expect(
        adapter.callTool(calConn, 'create_event', { summary: 'S', attendees: 'a@b.com' }),
      ).rejects.toMatchObject({ code: 'AUTH_FAILED' });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).attendees).toBeUndefined();
    });

    it('list_events defaults timeMin to now, passes timeMax, clamps maxResults', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-06T00:00:00Z'));
      fetchMock.mockResolvedValue(ok({ items: [{ summary: 'Standup', start: { dateTime: '2026-11-06T09:00:00Z' }, end: { dateTime: '2026-11-06T09:15:00Z' } }] }));
      const out = await adapter.callTool(calConn, 'list_events', { timeMax: '2026-11-07T00:00:00Z', maxResults: 100 });
      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.searchParams.get('timeMax')).toBe('2026-11-07T00:00:00Z');
      expect(url.searchParams.get('maxResults')).toBe('25');
      expect(url.searchParams.get('singleEvents')).toBe('true');
      expect(Number.isNaN(Date.parse(url.searchParams.get('timeMin')!))).toBe(false);
      expect(out).toContain('Standup');
    });

    it('list_events defaults to 10 results, suggest_time to 25 and uses the window', async () => {
      fetchMock.mockResolvedValue(ok({}));
      await adapter.callTool(calConn, 'list_events', { timeMin: '2026-11-06T00:00:00Z' });
      await adapter.callTool(calConn, 'suggest_time', { windowStart: '2026-11-06T08:00:00Z', windowEnd: '2026-11-06T18:00:00Z' });
      const a = new URL(fetchMock.mock.calls[0][0]).searchParams;
      const b = new URL(fetchMock.mock.calls[1][0]).searchParams;
      expect([a.get('maxResults'), a.get('timeMin'), a.has('timeMax')]).toEqual(['10', '2026-11-06T00:00:00Z', false]);
      expect([b.get('maxResults'), b.get('timeMin'), b.get('timeMax')]).toEqual(['25', '2026-11-06T08:00:00Z', '2026-11-06T18:00:00Z']);
    });

    it('suggest_time finds the first gap long enough, skipping overlaps and all-day events', async () => {
      fetchMock.mockResolvedValue(
        ok({
          items: [
            { start: { dateTime: '2026-11-06T09:30:00Z' }, end: { dateTime: '2026-11-06T10:00:00Z' } },
            { start: { dateTime: '2026-11-06T08:00:00Z' }, end: { dateTime: '2026-11-06T09:10:00Z' } },
            { start: { date: '2026-11-06' }, end: { date: '2026-11-07' } },
            { start: { dateTime: '2026-11-06T09:05:00Z' }, end: { dateTime: '2026-11-06T09:20:00Z' } },
            { start: { dateTime: '2026-11-06T11:00:00Z' }, end: { dateTime: '2026-11-06T12:00:00Z' } },
          ],
        }),
      );
      expect(
        await adapter.callTool(calConn, 'suggest_time', { windowStart: '2026-11-06T08:00:00Z', durationMins: 45 }),
      ).toBe('Next open 45-min slot: 2026-11-06T10:00:00.000Z');
    });

    it('suggest_time defaults to 30 minutes from now when the calendar is free', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-06T07:00:00Z'));
      fetchMock.mockResolvedValue(ok({ items: [] }));
      expect(await adapter.callTool(calConn, 'suggest_time', {})).toBe(
        'Next open 30-min slot: 2026-11-06T07:00:00.000Z',
      );
    });

    it('a failing listing is a coded error', async () => {
      silenceLogs();
      fetchMock.mockResolvedValue(fail(503));
      await expect(adapter.callTool(calConn, 'suggest_time', {})).rejects.toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Google Calendar is temporarily unavailable (HTTP 503).',
      });
    });
  });

  describe('token refresh', () => {
    const send = () => adapter.callTool(gmailConn, 'send_email', { to: 'a@b.com' });

    it('refreshes pre-emptively when the token expires within 60 s, posting client credentials', async () => {
      tokens({ access_token: 'old', refresh_token: 'r1', expiry_date: Date.now() + 10_000 });
      fetchMock.mockResolvedValueOnce(ok({ access_token: 'new', expires_in: 120 })).mockResolvedValueOnce(ok({}));
      await send();
      const [tokenUrl, init] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
      expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
        grant_type: 'refresh_token',
        refresh_token: 'r1',
        client_id: 'id',
        client_secret: 'sec',
      });
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
      const stored = JSON.parse(vault.encrypt.mock.calls[0][0]);
      expect(stored).toMatchObject({ access_token: 'new', refresh_token: 'r1' });
      expect(stored.expiry_date).toBeGreaterThan(Date.now() + 100_000);
      expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { $set: { encryptedTokens: vault.encrypt.mock.results[0].value } });
    });

    it('does not refresh a token that is still valid, or one without a refresh token', async () => {
      tokens({ access_token: 'fresh', refresh_token: 'r', expiry_date: Date.now() + 3_600_000 });
      fetchMock.mockResolvedValue(ok({}));
      await send();
      tokens({ access_token: 'only', expiry_date: Date.now() - 1 });
      await send();
      expect(fetchMock.mock.calls.map((c) => c[1].headers.Authorization)).toEqual(['Bearer fresh', 'Bearer only']);
    });

    it('uses tokens another request already refreshed (stored copy) instead of calling Google', async () => {
      vault.decrypt.mockImplementation((blob: any) =>
        JSON.stringify(blob.data === 'latest' ? { access_token: 'stored-new', refresh_token: 'r' } : { access_token: 'tok', refresh_token: 'r' }),
      );
      connModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: 'active', encryptedTokens: { data: 'latest' } }) });
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(ok({ id: 'm' }));
      await send();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer stored-new');
    });

    it('a connection marked expired/revoked in the DB yields CONNECTION_EXPIRED (no refresh)', async () => {
      connModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: 'expired' }) });
      fetchMock.mockResolvedValueOnce(fail(401));
      await expect(send()).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('invalid_grant marks the connection expired and yields CONNECTION_EXPIRED', async () => {
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(fail(400, '{"error":"invalid_grant","error_description":"Token has been expired or revoked."}'));
      silenceLogs();
      const err = await caught(send());
      expect(err).toMatchObject({ code: 'CONNECTION_EXPIRED' });
      expect(err.message).toContain('reconnect gmail');
      expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { $set: { status: 'expired' } });
    });

    it('still reports CONNECTION_EXPIRED when marking it expired fails', async () => {
      const warn = silenceLogs();
      connModel.updateOne.mockRejectedValue(new Error('mongo down'));
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(fail(400, '{"error":"invalid_grant"}'));
      await expect(send()).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not mark gmail expired'));
    });

    it('a connection without an id is never written (no markExpired, no token persist)', async () => {
      const conn = { provider: 'gmail', encryptedTokens: gmailConn.encryptedTokens };
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(fail(400, '{"error":"invalid_grant"}'));
      await expect(adapter.callTool(conn, 'send_email', { to: 'a@b.com' })).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(ok({ access_token: 'n2' })).mockResolvedValueOnce(ok({}));
      await adapter.callTool(conn, 'send_email', { to: 'a@b.com' });
      expect(connModel.updateOne).not.toHaveBeenCalled();
      expect(connModel.findById).not.toHaveBeenCalled();
    });

    it('a transient refresh failure keeps the original 401 → AUTH_FAILED, token never leaked', async () => {
      const warn = silenceLogs();
      tokens({ access_token: 'ya29.secret-access', refresh_token: '1//secret-refresh' });
      fetchMock.mockResolvedValueOnce(fail(401, '{"error":{"status":"UNAUTHENTICATED"}}')).mockResolvedValueOnce(fail(500, 'boom'));
      const err = await caught(send());
      expect(err).toMatchObject({ code: 'AUTH_FAILED' });
      expect(err.message).not.toMatch(/secret/);
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/secret-(access|refresh)/);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('a 401 with no refresh token is returned as AUTH_FAILED without calling Google', async () => {
      silenceLogs();
      tokens({ access_token: 'tok' });
      fetchMock.mockResolvedValue(fail(401));
      await expect(send()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('single-flight: concurrent 401s on one connection trigger ONE refresh', async () => {
      let refreshCalls = 0;
      fetchMock.mockImplementation(async (url: string, init: any) => {
        if (url.includes('oauth2')) {
          refreshCalls++;
          await new Promise((r) => setImmediate(r));
          return ok({ access_token: 'tok2' });
        }
        return init.headers.Authorization === 'Bearer tok2' ? ok({}) : fail(401);
      });
      await Promise.all([send(), send(), send()]);
      expect(refreshCalls).toBe(1);
    });

    it('uses empty client credentials when Google OAuth is not configured', async () => {
      cfg.get.mockReturnValue(undefined);
      fetchMock.mockResolvedValueOnce(fail(401)).mockResolvedValueOnce(ok({ access_token: 'n' })).mockResolvedValueOnce(ok({}));
      await send();
      const body = Object.fromEntries(new URLSearchParams(fetchMock.mock.calls[1][1].body));
      expect([body.client_id, body.client_secret]).toEqual(['', '']);
    });
  });

  describe('revoke — failure paths', () => {
    it('prefers the refresh token and posts it form-encoded', async () => {
      tokens({ access_token: 'a', refresh_token: 'r&x' });
      fetchMock.mockResolvedValue(ok());
      await adapter.revoke({ provider: 'gmail', _id: 'c1', accountLabel: 'me@x.com', encryptedTokens: gmailConn.encryptedTokens });
      expect(fetchMock.mock.calls[0][1].body).toBe('token=r%26x');
    });

    it('skips when there is no token at all', async () => {
      tokens({});
      await expect(adapter.revoke({ provider: 'gmail', accountLabel: 'me@x.com', encryptedTokens: gmailConn.encryptedTokens })).resolves.toBe('skipped');
      expect(connModel.find.mock.calls[0][0]._id).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports failed on a non-OK answer, a DB error, or a vault error', async () => {
      silenceLogs();
      const conn = { provider: 'gmail', _id: 'c1', accountLabel: 'me@x.com', encryptedTokens: gmailConn.encryptedTokens };
      fetchMock.mockResolvedValue(fail(400));
      await expect(adapter.revoke(conn)).resolves.toBe('failed');
      connModel.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('db')) });
      await expect(adapter.revoke(conn)).resolves.toBe('failed');
      connModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      vault.decrypt.mockImplementation(() => {
        throw new Error('bad tag');
      });
      await expect(adapter.revoke(conn)).resolves.toBe('failed');
    });
  });
});
