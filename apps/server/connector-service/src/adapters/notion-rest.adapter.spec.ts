import { NotionRestAdapter } from './notion-rest.adapter';

const PAGE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const DS_ID = '0123456789abcdef0123456789abcdef';

describe('NotionRestAdapter', () => {
  let adapter: NotionRestAdapter;
  let vault: any;
  let cfg: any;
  let connModel: any;
  let fetchMock: jest.Mock;
  let conn: any;

  const json = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  beforeEach(() => {
    conn = { provider: 'notion', _id: 'n1', encryptedTokens: { iv: 'i', tag: 't', data: 'd' } };
    vault = {
      decrypt: jest.fn().mockReturnValue(JSON.stringify({ access_token: 'tok', refresh_token: 'rt' })),
      encrypt: jest.fn().mockReturnValue({ iv: 'i2', tag: 't2', data: 'd2' }),
    };
    cfg = { get: jest.fn().mockReturnValue({ clientId: 'cid', clientSecret: 'csec' }) };
    connModel = {
      updateOne: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    adapter = new NotionRestAdapter(vault, cfg, connModel);
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  describe('listTools', () => {
    it('lists the 6 notion tools', async () => {
      const tools = await adapter.listTools(conn);
      expect(tools.map((t) => t.name)).toEqual([
        'search_pages',
        'get_page',
        'query_data_source',
        'create_page',
        'update_page',
        'update_page_content',
      ]);
    });

    it('marks the three read tools readOnly and the three write tools as writes', async () => {
      const hints = Object.fromEntries(
        (await adapter.listTools(conn)).map((t) => [t.name, t.annotations?.readOnlyHint]),
      );
      expect(hints).toEqual({
        search_pages: true,
        get_page: true,
        query_data_source: true,
        create_page: false,
        update_page: false,
        update_page_content: false,
      });
    });
  });

  describe('search_pages', () => {
    it('POSTs /v1/search with the bearer token and a pinned Notion-Version, and lists results', async () => {
      fetchMock.mockResolvedValue(
        json({
          results: [
            {
              object: 'page',
              id: 'p1',
              url: 'https://www.notion.so/p1',
              properties: { Name: { type: 'title', title: [{ plain_text: 'Roadmap' }] } },
            },
            { object: 'data_source', id: 'ds1', url: 'https://www.notion.so/ds1', title: [{ plain_text: 'Tasks' }] },
          ],
        }),
      );

      const out = await adapter.callTool(conn, 'search_pages', { query: 'road', type: 'page', maxResults: 5 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.notion.com/v1/search');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(init.headers['Notion-Version']).toBe('2026-03-11');
      expect(init.signal).toBeDefined();
      expect(JSON.parse(init.body)).toEqual({
        query: 'road',
        page_size: 5,
        filter: { property: 'object', value: 'page' },
      });
      expect(out).toContain('Found 2 result(s)');
      expect(out).toContain('[page] Roadmap (id: p1)');
      expect(out).toContain('[data_source] Tasks (id: ds1)');
    });

    it('caps maxResults at 20', async () => {
      fetchMock.mockResolvedValue(json({ results: [] }));
      await adapter.callTool(conn, 'search_pages', { maxResults: 500 });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).page_size).toBe(20);
    });

    it('says how to share pages when nothing is found', async () => {
      fetchMock.mockResolvedValue(json({ results: [] }));
      const out = await adapter.callTool(conn, 'search_pages', { query: 'x' });
      expect(out).toContain('Found 0 result(s)');
      expect(out).toContain('only sees pages shared with this connection');
    });
  });

  describe('get_page', () => {
    const rt = (s: string) => ({ rich_text: [{ plain_text: s }] });

    it('reads the page and its blocks and returns the title plus the text', async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({
            object: 'page',
            id: PAGE_ID,
            url: 'https://www.notion.so/p1',
            properties: { title: { type: 'title', title: [{ plain_text: 'Roadmap' }] } },
          }),
        )
        .mockResolvedValueOnce(
          json({
            results: [
              { type: 'heading_1', heading_1: rt('Goals') },
              { type: 'paragraph', paragraph: rt('Ship C1') },
              { type: 'bulleted_list_item', bulleted_list_item: rt('Connect Notion') },
              { type: 'to_do', to_do: { ...rt('Enable Google APIs'), checked: true } },
              { type: 'divider', divider: {} },
            ],
            has_more: false,
          }),
        );

      const out = await adapter.callTool(conn, 'get_page', { pageId: PAGE_ID });

      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.notion.com/v1/pages/${PAGE_ID}`);
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
      expect(fetchMock.mock.calls[1][0]).toBe(`https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100`);
      expect(out.split('\n')).toEqual([
        `Roadmap (id: ${PAGE_ID}) https://www.notion.so/p1`,
        '# Goals',
        'Ship C1',
        '- Connect Notion',
        '[x] Enable Google APIs',
      ]);
    });

    it('says so when the page has more blocks than were read', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ id: PAGE_ID, properties: {} }))
        .mockResolvedValueOnce(json({ results: [{ type: 'paragraph', paragraph: rt('x') }], has_more: true }));

      const out = await adapter.callTool(conn, 'get_page', { pageId: PAGE_ID });

      expect(out).toContain('(more content not shown)');
    });

    it('fails with a tool error when reading the blocks fails', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ id: PAGE_ID, properties: {} }))
        .mockResolvedValueOnce(json({ code: 'restricted_resource', message: 'no' }, 403));

      await expect(adapter.callTool(conn, 'get_page', { pageId: PAGE_ID })).rejects.toEqual(
        expect.objectContaining({ code: 'PERMISSION_DENIED' }),
      );
    });
  });

  describe('query_data_source', () => {
    it('POSTs the data source query and summarises each row', async () => {
      fetchMock.mockResolvedValue(
        json({
          results: [
            {
              object: 'page',
              id: 'r1',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Wire Notion REST' }] },
                Status: { type: 'status', status: { name: 'In progress' } },
                Due: { type: 'date', date: { start: '2026-11-06' } },
                Owner: { type: 'people', people: [{ name: 'Minh' }] },
              },
            },
          ],
        }),
      );
      const filter = { property: 'Status', status: { equals: 'In progress' } };

      const out = await adapter.callTool(conn, 'query_data_source', { dataSourceId: DS_ID, filter, maxResults: 10 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.notion.com/v1/data_sources/${DS_ID}/query`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ page_size: 10, filter });
      expect(out).toContain('Found 1 row(s)');
      expect(out).toContain('- Wire Notion REST (id: r1) | Status: In progress | Due: 2026-11-06 | Owner: Minh');
    });

    it('does not send a filter that is not an object', async () => {
      fetchMock.mockResolvedValue(json({ results: [] }));
      await adapter.callTool(conn, 'query_data_source', { dataSourceId: DS_ID, filter: 'oops' });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ page_size: 10 });
    });
  });

  describe('create_page', () => {
    const text = (content: string) => ({ type: 'text', text: { content } });
    const para = (content: string) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [text(content)] },
    });

    it('under a parent page sends the title and one paragraph per line', async () => {
      fetchMock.mockResolvedValue(json({ id: 'new1', url: 'https://www.notion.so/new1' }));

      const out = await adapter.callTool(conn, 'create_page', {
        parentPageId: PAGE_ID,
        title: 'Weekly status',
        content: 'Done: C1\n\nNext: C3',
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.notion.com/v1/pages');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        parent: { type: 'page_id', page_id: PAGE_ID },
        properties: { title: { title: [text('Weekly status')] } },
        children: [para('Done: C1'), para('Next: C3')],
      });
      expect(out).toBe('Page "Weekly status" created (id: new1) https://www.notion.so/new1');
    });

    it("in a data source titles the row via that data source's title property", async () => {
      fetchMock
        .mockResolvedValueOnce(
          json({ id: DS_ID, properties: { Status: { type: 'status' }, 'Task name': { type: 'title' } } }),
        )
        .mockResolvedValueOnce(json({ id: 'row1', url: 'https://www.notion.so/row1' }));

      const out = await adapter.callTool(conn, 'create_page', { dataSourceId: DS_ID, title: 'Wire Notion REST' });

      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.notion.com/v1/data_sources/${DS_ID}`);
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        parent: { type: 'data_source_id', data_source_id: DS_ID },
        properties: { 'Task name': { title: [text('Wire Notion REST')] } },
      });
      expect(out).toBe('Page "Wire Notion REST" created (id: row1) https://www.notion.so/row1');
    });

    it.each([
      [{ title: 'x' }],
      [{ title: 'x', parentPageId: PAGE_ID, dataSourceId: DS_ID }],
      [{ parentPageId: PAGE_ID }],
      [{ title: '   ', parentPageId: PAGE_ID }],
    ])('refuses %j without a title and exactly one parent, sending nothing', async (input) => {
      await expect(adapter.callTool(conn, 'create_page', input)).rejects.toEqual(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses more than 100 lines of content (one Notion request holds 100 blocks)', async () => {
      const content = Array.from({ length: 101 }, (_, i) => `line ${i}`).join('\n');
      await expect(
        adapter.callTool(conn, 'create_page', { parentPageId: PAGE_ID, title: 'x', content }),
      ).rejects.toEqual(expect.objectContaining({ code: 'INVALID_INPUT' }));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('update_page', () => {
    it('PATCHes the page with the new title merged into the given properties', async () => {
      fetchMock.mockResolvedValue(json({ id: PAGE_ID, url: 'https://www.notion.so/p1' }));

      const out = await adapter.callTool(conn, 'update_page', {
        pageId: PAGE_ID,
        title: 'Roadmap v2',
        properties: { Status: { status: { name: 'Done' } } },
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.notion.com/v1/pages/${PAGE_ID}`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({
        properties: {
          Status: { status: { name: 'Done' } },
          title: { title: [{ type: 'text', text: { content: 'Roadmap v2' } }] },
        },
      });
      expect(out).toBe(`Page ${PAGE_ID} updated https://www.notion.so/p1`);
    });

    it('refuses when there is nothing to change', async () => {
      await expect(adapter.callTool(conn, 'update_page', { pageId: PAGE_ID })).rejects.toEqual(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('update_page_content', () => {
    it('appends one paragraph per line to the page', async () => {
      fetchMock.mockResolvedValue(json({ results: [{}, {}] }));

      const out = await adapter.callTool(conn, 'update_page_content', {
        pageId: PAGE_ID,
        content: 'Decision: REST adapter\nOwner: Minh',
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`https://api.notion.com/v1/blocks/${PAGE_ID}/children`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body).children).toHaveLength(2);
      expect(out).toBe(`Added 2 paragraph(s) to page ${PAGE_ID}`);
    });

    it('refuses blank content or more than 100 lines, sending nothing', async () => {
      for (const content of ['  \n ', Array.from({ length: 101 }, () => 'x').join('\n')]) {
        await expect(adapter.callTool(conn, 'update_page_content', { pageId: PAGE_ID, content })).rejects.toEqual(
          expect.objectContaining({ code: 'INVALID_INPUT' }),
        );
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("splits a line longer than Notion's 2000-char limit into chunks", async () => {
      fetchMock.mockResolvedValue(json({ results: [{}] }));
      await adapter.callTool(conn, 'update_page_content', { pageId: PAGE_ID, content: 'a'.repeat(4500) });
      const sizes = JSON.parse(fetchMock.mock.calls[0][1].body).children[0].paragraph.rich_text.map(
        (r: { text: { content: string } }) => r.text.content.length,
      );
      expect(sizes).toEqual([2000, 2000, 500]);
    });
  });

  describe.each([
    ['query_data_source', { dataSourceId: DS_ID }],
    ['create_page', { parentPageId: PAGE_ID, title: 'x' }],
    ['update_page', { pageId: PAGE_ID, title: 'x' }],
    ['update_page_content', { pageId: PAGE_ID, content: 'x' }],
  ])('%s', (tool, input) => {
    it('surfaces a Notion rejection as a coded tool error', async () => {
      fetchMock.mockResolvedValue(json({ code: 'restricted_resource', message: 'no' }, 403));
      await expect(adapter.callTool(conn, tool, input as Record<string, unknown>)).rejects.toEqual(
        expect.objectContaining({ code: 'PERMISSION_DENIED' }),
      );
    });
  });

  describe('token lifecycle (Notion rotates refresh tokens)', () => {
    const tokens = (access: string, refresh?: string) => ({
      access_token: access,
      ...(refresh ? { refresh_token: refresh } : {}),
      workspace_name: 'Minh WS',
      bot_id: 'bot1',
    });
    const blobs: Record<string, object> = {
      d: tokens('tok', 'rt'),
      d2: tokens('tok2', 'rt2'),
      norefresh: tokens('tok'),
      other: tokens('tokX', 'rtX'),
    };
    const stored = (status: string | null, blob?: { iv: string; tag: string; data: string }) =>
      connModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(status ? { status, encryptedTokens: blob } : null),
      });
    const unauthorizedForOldToken = (okBody: unknown = { results: [] }) =>
      fetchMock.mockImplementation(async (url: string, init: any) => {
        if (String(url).endsWith('/oauth/token')) return json({ access_token: 'tok2', refresh_token: 'rt2' });
        if (init.headers.Authorization === 'Bearer tok') return json({ code: 'unauthorized' }, 401);
        return json(okBody);
      });

    beforeEach(() => {
      vault.decrypt.mockImplementation((b: { data: string }) => JSON.stringify(blobs[b.data] ?? blobs.d));
    });

    it('on a 401 refreshes with the stored refresh_token, saves the rotated pair and retries once', async () => {
      unauthorizedForOldToken();

      const out = await adapter.callTool(conn, 'search_pages', { query: 'x' });

      const refreshCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/oauth/token'))!;
      expect(refreshCall[0]).toBe('https://api.notion.com/v1/oauth/token');
      expect(refreshCall[1].method).toBe('POST');
      expect(refreshCall[1].headers.Authorization).toBe(`Basic ${Buffer.from('cid:csec').toString('base64')}`);
      expect(refreshCall[1].signal).toBeDefined();
      expect(JSON.parse(refreshCall[1].body)).toEqual({ grant_type: 'refresh_token', refresh_token: 'rt' });
      // the rotated pair replaces the stored one, keeping the workspace fields
      expect(JSON.parse(vault.encrypt.mock.calls[0][0])).toEqual(
        expect.objectContaining({ access_token: 'tok2', refresh_token: 'rt2', workspace_name: 'Minh WS', bot_id: 'bot1' }),
      );
      expect(connModel.updateOne).toHaveBeenCalledWith(
        { _id: 'n1' },
        { $set: { encryptedTokens: { iv: 'i2', tag: 't2', data: 'd2' } } },
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer tok2');
      expect(out).toContain('Found 0 result(s)');
    });

    it('later requests of the same tool call use the new token, not the spent one', async () => {
      unauthorizedForOldToken({ id: PAGE_ID, properties: {}, results: [] });

      await adapter.callTool(conn, 'get_page', { pageId: PAGE_ID });

      const calls = fetchMock.mock.calls.filter(([u]) => !String(u).endsWith('/oauth/token'));
      expect(calls.map(([, i]) => i.headers.Authorization)).toEqual(['Bearer tok', 'Bearer tok2', 'Bearer tok2']);
      expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/oauth/token'))).toHaveLength(1);
    });

    it('uses the token another request already stored instead of spending the refresh token again', async () => {
      stored('active', { iv: 'i', tag: 't', data: 'other' });
      fetchMock.mockImplementation(async (_u: string, init: any) =>
        init.headers.Authorization === 'Bearer tok' ? json({}, 401) : json({ results: [] }),
      );

      await adapter.callTool(conn, 'search_pages', {});

      expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/oauth/token'))).toHaveLength(0);
      expect(fetchMock.mock.calls.at(-1)![1].headers.Authorization).toBe('Bearer tokX');
    });

    it('concurrent 401s on one connection share a single refresh', async () => {
      unauthorizedForOldToken();

      await Promise.all([
        adapter.callTool(conn, 'search_pages', {}),
        adapter.callTool({ ...conn }, 'search_pages', {}),
      ]);

      expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/oauth/token'))).toHaveLength(1);
    });

    it('marks the connection expired and says to reconnect when the refresh token is dead', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).endsWith('/oauth/token') ? json({ error: 'invalid_grant' }, 400) : json({}, 401),
      );

      await expect(adapter.callTool(conn, 'search_pages', {})).rejects.toEqual(
        expect.objectContaining({ code: 'CONNECTION_EXPIRED' }),
      );
      expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'n1' }, { $set: { status: 'expired' } });
    });

    it('marks it expired too when a 401 comes back and there is no refresh token to try', async () => {
      conn.encryptedTokens = { iv: 'i', tag: 't', data: 'norefresh' };
      fetchMock.mockResolvedValue(json({}, 401));

      await expect(adapter.callTool(conn, 'search_pages', {})).rejects.toEqual(
        expect.objectContaining({ code: 'CONNECTION_EXPIRED' }),
      );
      expect(connModel.updateOne).toHaveBeenCalledWith({ _id: 'n1' }, { $set: { status: 'expired' } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not even try to refresh a connection that is already expired', async () => {
      stored('expired', { iv: 'i', tag: 't', data: 'd' });
      fetchMock.mockResolvedValue(json({}, 401));

      await expect(adapter.callTool(conn, 'search_pages', {})).rejects.toEqual(
        expect.objectContaining({ code: 'CONNECTION_EXPIRED' }),
      );
      expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/oauth/token'))).toHaveLength(0);
    });

    it('keeps the connection active when the refresh fails for a passing reason (Notion down)', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        String(url).endsWith('/oauth/token') ? json({}, 503) : json({}, 401),
      );

      await expect(adapter.callTool(conn, 'search_pages', {})).rejects.toEqual(
        expect.objectContaining({ code: 'AUTH_FAILED' }),
      );
      expect(connModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('revoke (on disconnect)', () => {
    it("POSTs the access token to Notion's revoke endpoint with the client credentials", async () => {
      fetchMock.mockResolvedValue(json({}));

      const outcome = await adapter.revoke!(conn);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.notion.com/v1/oauth/revoke');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('cid:csec').toString('base64')}`);
      expect(init.signal).toBeDefined();
      expect(JSON.parse(init.body)).toEqual({ token: 'tok' });
      expect(outcome).toBe('revoked');
    });

    it("reports 'failed' when Notion refuses or the call throws, never throwing itself", async () => {
      fetchMock.mockResolvedValueOnce(json({}, 400));
      expect(await adapter.revoke!(conn)).toBe('failed');
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      expect(await adapter.revoke!(conn)).toBe('failed');
    });

    it("reports 'skipped' for a connection without tokens", async () => {
      expect(await adapter.revoke!({ provider: 'notion' })).toBe('skipped');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it.each([
      [400, 'validation_error', 'UPSTREAM_ERROR', 'validation_error'],
      [403, 'restricted_resource', 'PERMISSION_DENIED', 'restricted_resource'],
      [429, 'rate_limited', 'RATE_LIMITED', 'rate limiting'],
      [503, 'service_unavailable', 'UPSTREAM_UNAVAILABLE', 'temporarily unavailable'],
    ])('maps HTTP %s to a coded tool error without leaking the body', async (status, code, toolCode, text) => {
      fetchMock.mockResolvedValue(json({ object: 'error', status, code, message: 'private page title here' }, status));

      const err = await adapter.callTool(conn, 'search_pages', { query: 'x' }).catch((e) => e);

      expect(err).toEqual(expect.objectContaining({ name: 'ToolExecutionError', code: toolCode }));
      expect(err.message).toContain(text);
      expect(err.message).not.toContain('private page title here');
    });

    it('tells the model to share the page when Notion answers 404 object_not_found', async () => {
      fetchMock.mockResolvedValue(
        json({ code: 'object_not_found', message: `Could not find page with ID: ${PAGE_ID}.` }, 404),
      );

      const err = await adapter.callTool(conn, 'get_page', { pageId: PAGE_ID }).catch((e) => e);

      expect(err).toEqual(expect.objectContaining({ code: 'NOT_FOUND' }));
      expect(err.message).toContain('not be shared with this connection');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown tool', async () => {
      await expect(adapter.callTool(conn, 'delete_everything', {})).rejects.toEqual(
        expect.objectContaining({ code: 'UNKNOWN_TOOL' }),
      );
    });
  });

  describe('ids go into URL paths, so they are validated before any request', () => {
    it.each([
      ['get_page', { pageId: '../../v1/users' }],
      ['get_page', {}],
      ['query_data_source', { dataSourceId: 'abc/query?x=1' }],
      ['update_page', { pageId: '12', title: 'x' }],
      ['update_page_content', { pageId: '../x', content: 'x' }],
      ['create_page', { parentPageId: 'not-an-id', title: 'x' }],
      ['create_page', { dataSourceId: '../x', title: 'x' }],
    ])('%s %j → INVALID_INPUT, nothing sent', async (tool, input) => {
      await expect(adapter.callTool(conn, tool, input)).rejects.toEqual(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
