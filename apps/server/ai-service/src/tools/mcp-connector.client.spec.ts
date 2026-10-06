import { McpConnectorClient, WRITE_TIMEOUT_RESULT } from './mcp-connector.client';

function makeClient(): McpConnectorClient {
  const cfg = {
    get: (key: string) => {
      if (key === 'config.connector.internalUrl') return 'http://localhost:3003';
      if (key === 'config.connector.internalApiKey') return 'secret-key';
      return undefined;
    },
  } as any;
  return new McpConnectorClient(cfg);
}

describe('McpConnectorClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTools', () => {
    it('maps response tools to ToolDefinition[]', async () => {
      const tools = [
        {
          name: 'mcp__notion__create_page',
          description: 'Create a Notion page',
          input_schema: {
            type: 'object',
            properties: { title: { type: 'string' } },
            required: ['title'],
          },
        },
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ tools }),
      }) as any;

      const client = makeClient();
      const result = await client.getTools('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mcp__notion__create_page');
      expect(result[0].description).toBe('Create a Notion page');
      expect(result[0].input_schema.required).toEqual(['title']);

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[0]).toContain('/internal/tools');
      expect(call[0]).toContain('userId=user-1');
      expect(call[1].headers['x-internal-key']).toBe('secret-key');
    });

    it('keeps connector `sensitive` internally and drops actionGroup / unknown fields', async () => {
      const schema = { type: 'object', properties: {}, required: [] };
      const tools = [
        { name: 'mcp__gmail__send_email', description: 'Send', input_schema: schema, sensitive: true, actionGroup: 'create', extra: 1 },
        { name: 'mcp__gmail__search_threads', description: 'Search', input_schema: schema, sensitive: false, actionGroup: 'view' },
        // Older connector without the flag → local heuristic, never "not sensitive" for a write.
        { name: 'mcp__notion__create_page', description: 'Create', input_schema: schema },
        { name: 'mcp__notion__search', description: 'Search', input_schema: schema },
      ];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ tools }),
      }) as any;

      const result = await makeClient().getTools('user-1');

      expect(result.map((t) => t.sensitive)).toEqual([true, false, true, false]);
      for (const t of result) {
        expect(Object.keys(t).sort()).toEqual(['description', 'input_schema', 'name', 'sensitive']);
      }
    });

    it('resolves to [] when fetch rejects (never throws)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;
      const client = makeClient();
      const result = await client.getTools('user-1');
      expect(result).toEqual([]);
    });

    it('resolves to [] on non-2xx response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      }) as any;
      const client = makeClient();
      const result = await client.getTools('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('callTool', () => {
    it('returns the result string on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ result: 'page created' }),
      }) as any;
      const client = makeClient();
      const result = await client.callTool('user-1', 'mcp__notion__create_page', {
        title: 'PON test',
      });
      expect(result).toBe('page created');

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[0]).toContain('/internal/tools/call');
      expect(call[1].method).toBe('POST');
      expect(call[1].headers['x-internal-key']).toBe('secret-key');
      expect(JSON.parse(call[1].body)).toEqual({
        userId: 'user-1',
        name: 'mcp__notion__create_page',
        input: { title: 'PON test' },
      });
    });

    it('opts.write gives a markerless (connector-flagged) write the write timeout + outcome-unknown result', async () => {
      const cfg = {
        get: (key: string) =>
          ({
            'config.connector.internalUrl': 'http://localhost:3003',
            'config.connector.internalApiKey': 'k',
            'config.connector.readTimeoutMs': 10,
            'config.connector.writeTimeoutMs': 30,
          })[key],
      } as any;
      const hang = jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
      global.fetch = hang as any;
      const client = new McpConnectorClient(cfg);

      // `archive_page` carries no local write marker.
      await expect(client.callTool('u', 'mcp__notion__archive_page', {})).resolves.toBe(
        'Tool error: connector unavailable',
      );
      await expect(
        client.callTool('u', 'mcp__notion__archive_page', {}, { write: true }),
      ).resolves.toBe(WRITE_TIMEOUT_RESULT);
    });

    it('returns connector-unavailable message when fetch rejects', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as any;
      const client = makeClient();
      const result = await client.callTool('user-1', 'mcp__notion__create_page', {});
      expect(result).toBe('Tool error: connector unavailable');
    });

    it('returns connector-unavailable message on non-2xx response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValue({}),
      }) as any;
      const client = makeClient();
      const result = await client.callTool('user-1', 'mcp__notion__create_page', {});
      expect(result).toBe('Tool error: connector unavailable');
    });
  });
});
