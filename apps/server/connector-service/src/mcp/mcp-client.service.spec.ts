import { McpClientService, McpAuth } from './mcp-client.service';

class FakeClient {
  connected = false;
  closed = false;
  constructor(public readonly tag: string) {}
  async connect() {
    this.connected = true;
  }
  async listTools() {
    return {
      tools: [
        {
          name: 'create_page',
          description: 'Create a page',
          inputSchema: { type: 'object', properties: { title: {} } },
        },
        {
          name: 'search',
          description: 'Search',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };
  }
  async callTool(params: { name: string; arguments: unknown }) {
    return {
      content: [
        { type: 'text', text: `called ${params.name} ` },
        { type: 'text', text: 'with result' },
      ],
    };
  }
  async close() {
    this.closed = true;
  }
}

class TestableMcpClientService extends McpClientService {
  public created: FakeClient[] = [];
  protected async createClient(url: string, _auth: McpAuth): Promise<any> {
    const c = new FakeClient(url);
    await c.connect();
    this.created.push(c);
    return c;
  }
}

describe('McpClientService', () => {
  let svc: TestableMcpClientService;
  const auth: McpAuth = { type: 'bearer', token: 'tkn' };

  beforeEach(() => {
    svc = new TestableMcpClientService();
  });

  it('maps SDK tools to McpTool[]', async () => {
    const tools = await svc.listTools('https://mcp.example/sse', auth);
    expect(tools.map((t) => t.name)).toEqual(['create_page', 'search']);
    expect(tools[0].inputSchema).toEqual({
      type: 'object',
      properties: { title: {} },
    });
  });

  it('joins text content from callTool', async () => {
    const out = await svc.callTool('https://mcp.example/sse', auth, 'create_page', {
      title: 'X',
    });
    expect(out).toBe('called create_page with result');
  });

  it('caches the client by url+token (one client across calls)', async () => {
    await svc.listTools('https://mcp.example/sse', auth);
    await svc.callTool('https://mcp.example/sse', auth, 'search', {});
    expect(svc.created.length).toBe(1);
  });

  it('closes all clients on module destroy', async () => {
    await svc.listTools('https://mcp.example/sse', auth);
    await svc.onModuleDestroy();
    expect(svc.created[0].closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resilience: transport fallback, auth headers, retry policy, cache hygiene.
// ---------------------------------------------------------------------------

const sdk = {
  connect: jest.fn(),
  close: jest.fn(),
  transports: [] as Array<{ kind: string; url: URL; opts: any }>,
};

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: (...a: unknown[]) => sdk.connect(...a),
    close: () => sdk.close(),
  })),
}));
jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn().mockImplementation((url: URL, opts: unknown) => {
    const t = { kind: 'sse', url, opts };
    sdk.transports.push(t);
    return t;
  }),
}));
jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation((url: URL, opts: unknown) => {
    const t = { kind: 'streamable', url, opts };
    sdk.transports.push(t);
    return t;
  }),
}));

import { httpStatusOf, McpClientLike, McpTransportKind } from './mcp-client.service';
import { ToolExecutionError } from '../internal/tool-errors';
import { UnsafeUrlError } from '../security/url-guard';

function httpErr(code: number, ctorName = 'StreamableHTTPError'): Error {
  const Ctor = { [ctorName]: class extends Error {} }[ctorName];
  const e = new Ctor(`HTTP ${code}`);
  (e as any).code = code;
  return e;
}

function mcpErr(code: number): Error {
  const e = new Error(`mcp ${code}`);
  e.name = 'McpError';
  (e as any).code = code;
  return e;
}

/** Records connect() calls per transport; each call is answered by the next scripted outcome. */
class ConnectSpyService extends McpClientService {
  calls: Array<{ kind: McpTransportKind; url: string; headers: Record<string, string> }> = [];
  outcomes: Array<Error | McpClientLike> = [];
  protected async connect(kind: McpTransportKind, url: URL, headers: Record<string, string>) {
    this.calls.push({ kind, url: url.toString(), headers });
    const next = this.outcomes.shift();
    if (next instanceof Error) throw next;
    return next ?? scripted();
  }
  callConnect(kind: McpTransportKind, url: string, headers: Record<string, string>) {
    return super.connect(kind, new URL(url), headers);
  }
}

/** A client whose listTools / callTool answers are scripted per call. */
function scripted(
  opts: {
    list?: Array<any>;
    call?: Array<any>;
  } = {},
): McpClientLike & { closed: number; listArgs: unknown[]; callArgs: unknown[] } {
  const list = [...(opts.list ?? [])];
  const call = [...(opts.call ?? [])];
  const c = {
    closed: 0,
    listArgs: [] as unknown[],
    callArgs: [] as unknown[],
    async listTools(params?: unknown, options?: unknown) {
      c.listArgs.push([params, options]);
      const r = list.shift() ?? { tools: [] };
      if (r instanceof Error) throw r;
      return r;
    },
    async callTool(params: unknown, schema?: unknown, options?: unknown) {
      c.callArgs.push([params, schema, options]);
      const r = call.shift() ?? { content: [] };
      if (r instanceof Error) throw r;
      return r;
    },
    async close() {
      c.closed++;
    },
  };
  return c;
}

/** Hands out pre-built clients in order from createClient. */
class QueueService extends McpClientService {
  queue: Array<McpClientLike | Error> = [];
  createdFor: string[] = [];
  protected async createClient(url: string): Promise<McpClientLike> {
    this.createdFor.push(url);
    const next = this.queue.shift();
    if (!next) throw new Error('no client scripted');
    if (next instanceof Error) throw next;
    return next;
  }
}

describe('httpStatusOf', () => {
  it('reads an HTTP status from a transport error code', () => {
    expect(httpStatusOf(httpErr(401))).toBe(401);
    expect(httpStatusOf(httpErr(503))).toBe(503);
  });

  it('ignores MCP protocol codes, out-of-range and missing codes', () => {
    expect(httpStatusOf(mcpErr(404))).toBeUndefined();
    expect(httpStatusOf(httpErr(-32000))).toBeUndefined();
    expect(httpStatusOf(httpErr(600))).toBeUndefined();
    expect(httpStatusOf(Object.assign(new Error('x'), { code: '401' }))).toBeUndefined();
    expect(httpStatusOf(null)).toBeUndefined();
  });
});

describe('McpClientService.createClient (transport selection + auth headers)', () => {
  let svc: ConnectSpyService;
  beforeEach(() => {
    svc = new ConnectSpyService();
  });

  it('tries Streamable HTTP first and sends the bearer token as Authorization', async () => {
    await svc.discoverTools('https://mcp.example/mcp', { type: 'bearer', token: 'secret-1' });
    expect(svc.calls).toEqual([
      { kind: 'streamable', url: 'https://mcp.example/mcp', headers: { Authorization: 'Bearer secret-1' } },
    ]);
  });

  it('prefers SSE first for a /sse path (trailing slash, any case)', async () => {
    await svc.discoverTools('https://mcp.example/SSE/', { type: 'none' });
    expect(svc.calls.map((c) => c.kind)).toEqual(['sse']);
    expect(svc.calls[0].headers).toEqual({});
  });

  it('sends an API key as X-API-Key and nothing when the token is missing', async () => {
    await svc.discoverTools('https://mcp.example/a', { type: 'apikey', token: 'k-9' });
    await svc.discoverTools('https://mcp.example/b', { type: 'bearer' });
    await svc.discoverTools('https://mcp.example/c', { type: 'apikey', token: '' });
    expect(svc.calls.map((c) => c.headers)).toEqual([{ 'X-API-Key': 'k-9' }, {}, {}]);
  });

  it('falls back to the other transport on a generic failure', async () => {
    svc.outcomes = [httpErr(405), scripted({ list: [{ tools: [{ name: 't' }] }] })];
    const tools = await svc.discoverTools('https://mcp.example/mcp', { type: 'none' });
    expect(svc.calls.map((c) => c.kind)).toEqual(['streamable', 'sse']);
    expect(tools.map((t) => t.name)).toEqual(['t']);
  });

  it.each([401, 403])('does not fall back on HTTP %i (bad credentials fail on both)', async (code) => {
    const err = httpErr(code);
    svc.outcomes = [err];
    await expect(svc.discoverTools('https://mcp.example/mcp', { type: 'none' })).rejects.toBe(err);
    expect(svc.calls).toHaveLength(1);
  });

  it('does not fall back when the URL is blocked by the SSRF guard', async () => {
    svc.outcomes = [new UnsafeUrlError('private address')];
    await expect(svc.discoverTools('https://mcp.example/mcp', { type: 'none' })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    expect(svc.calls).toHaveLength(1);
  });

  it('throws the last error when both transports fail', async () => {
    const last = httpErr(502);
    svc.outcomes = [httpErr(500), last];
    await expect(svc.discoverTools('https://mcp.example/mcp', { type: 'none' })).rejects.toBe(last);
  });

  it('rejects a malformed URL before connecting', async () => {
    await expect(svc.discoverTools('not a url', { type: 'none' })).rejects.toThrow('Invalid URL');
    expect(svc.calls).toHaveLength(0);
  });
});

describe('McpClientService.connect (SDK wiring)', () => {
  let svc: ConnectSpyService;
  beforeEach(() => {
    svc = new ConnectSpyService();
    sdk.connect.mockReset().mockResolvedValue(undefined);
    sdk.close.mockReset().mockResolvedValue(undefined);
    sdk.transports = [];
  });

  it('builds a Streamable HTTP transport with headers + SSRF-guarded fetch and a connect timeout', async () => {
    const { safeFetch } = jest.requireActual('../security/url-guard');
    await svc.callConnect('streamable', 'https://mcp.example/mcp', { Authorization: 'Bearer t' });
    expect(sdk.transports).toHaveLength(1);
    expect(sdk.transports[0].kind).toBe('streamable');
    expect(sdk.transports[0].opts).toEqual({ requestInit: { headers: { Authorization: 'Bearer t' } }, fetch: safeFetch });
    expect(sdk.connect).toHaveBeenCalledWith(sdk.transports[0], { timeout: 10_000 });
  });

  it('builds an SSE transport for kind=sse', async () => {
    await svc.callConnect('sse', 'https://mcp.example/sse', {});
    expect(sdk.transports.map((t) => t.kind)).toEqual(['sse']);
  });

  it('closes the half-open client when connect fails (even if close also fails)', async () => {
    const boom = new Error('connect timeout');
    sdk.connect.mockRejectedValue(boom);
    sdk.close.mockRejectedValue(new Error('already closed'));
    await expect(svc.callConnect('streamable', 'https://mcp.example/mcp', {})).rejects.toBe(boom);
    expect(sdk.close).toHaveBeenCalledTimes(1);
  });
});

describe('McpClientService tool listing + calls', () => {
  let svc: QueueService;
  const none: McpAuth = { type: 'none' };
  beforeEach(() => {
    svc = new QueueService();
  });

  it('follows nextCursor across pages, defaults description/schema and keeps annotations', async () => {
    const c = scripted({
      list: [
        { tools: [{ name: 'a', annotations: { readOnlyHint: true } }], nextCursor: 'p2' },
        { tools: undefined, nextCursor: 'p3' },
        { tools: [{ name: 'b', description: 'B', inputSchema: { type: 'object' } }] },
      ],
    });
    svc.queue = [c];
    const tools = await svc.listTools('https://m.example', none);
    expect(tools).toEqual([
      { name: 'a', description: '', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
      { name: 'b', description: 'B', inputSchema: { type: 'object' } },
    ]);
    expect(c.listArgs).toEqual([
      [undefined, { timeout: 10_000 }],
      [{ cursor: 'p2' }, { timeout: 10_000 }],
      [{ cursor: 'p3' }, { timeout: 10_000 }],
    ]);
  });

  it('stops after 10 pages even if the server keeps returning a cursor', async () => {
    const pages = Array.from({ length: 15 }, (_, i) => ({ tools: [{ name: `t${i}` }], nextCursor: 'again' }));
    const c = scripted({ list: pages });
    svc.queue = [c];
    const tools = await svc.listTools('https://m.example', none);
    expect(tools).toHaveLength(10);
    expect(c.listArgs).toHaveLength(10);
  });

  it('passes the call timeout and turns isError into a clipped TOOL_FAILED error', async () => {
    const c = scripted({ call: [{ isError: true, content: [{ type: 'text', text: 'x'.repeat(5000) }] }] });
    svc.queue = [c];
    const err = await svc.callTool('https://m.example', none, 'do', { a: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ToolExecutionError);
    expect(err.code).toBe('TOOL_FAILED');
    expect(err.message.length).toBeLessThanOrEqual(1001);
    expect(c.callArgs[0]).toEqual([{ name: 'do', arguments: { a: 1 } }, undefined, { timeout: 60_000 }]);
  });

  it('uses a default message when an error result has no text, and {} for missing input', async () => {
    const c = scripted({ call: [{ isError: true }] });
    svc.queue = [c];
    await expect(svc.callTool('https://m.example', none, 'do', undefined as any)).rejects.toThrow(
      'The tool reported an error.',
    );
    expect((c.callArgs[0] as any[])[0]).toEqual({ name: 'do', arguments: {} });
  });

  it('keeps only text parts, trimmed', async () => {
    svc.queue = [
      scripted({
        call: [{ content: [{ type: 'image' }, { type: 'text', text: '  hi ' }, { text: 'there  ' }, { type: 'text' }] }],
      }),
    ];
    expect(await svc.callTool('https://m.example', none, 'do', {})).toBe('hi there');
  });

  it('discoverTools never caches and always closes the client, even on failure', async () => {
    const ok = scripted({ list: [{ tools: [{ name: 'x' }] }] });
    const bad = scripted({ list: [new Error('boom')] });
    svc.queue = [ok, bad];
    await svc.discoverTools('https://m.example', none);
    await expect(svc.discoverTools('https://m.example', none)).rejects.toThrow('boom');
    expect(ok.closed).toBe(1);
    expect(bad.closed).toBe(1);
    expect(svc.createdFor).toHaveLength(2);
  });
});

describe('McpClientService retry policy', () => {
  let svc: QueueService;
  const none: McpAuth = { type: 'none' };
  beforeEach(() => {
    svc = new QueueService();
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
  });

  it('reconnects once and retries a read (listTools) after a transport error', async () => {
    const dead = scripted({ list: [new Error('socket hang up')] });
    const fresh = scripted({ list: [{ tools: [{ name: 'ok' }] }] });
    svc.queue = [dead, fresh];
    const tools = await svc.listTools('https://m.example', none);
    expect(tools.map((t) => t.name)).toEqual(['ok']);
    expect(dead.closed).toBe(1);
  });

  it('retries only once — a second transport failure surfaces', async () => {
    const e2 = new Error('still down');
    svc.queue = [scripted({ list: [new Error('down')] }), scripted({ list: [e2] })];
    await expect(svc.listTools('https://m.example', none)).rejects.toBe(e2);
    expect(svc.createdFor).toHaveLength(2);
  });

  it('does NOT retry a write (callTool) whose delivery is unknown', async () => {
    const err = httpErr(502);
    const dead = scripted({ call: [err] });
    svc.queue = [dead, scripted()];
    await expect(svc.callTool('https://m.example', none, 'send_email', {})).rejects.toBe(err);
    expect(svc.createdFor).toHaveLength(1);
    expect(dead.closed).toBe(1); // evicted anyway
  });

  it('retries a write when the session was unknown to the server (StreamableHTTPError 404)', async () => {
    svc.queue = [scripted({ call: [httpErr(404)] }), scripted({ call: [{ content: [{ type: 'text', text: 'sent' }] }] })];
    expect(await svc.callTool('https://m.example', none, 'send_email', {})).toBe('sent');
  });

  it('does not treat a 404 from another error class as undelivered', async () => {
    const err = httpErr(404, 'SseError');
    svc.queue = [scripted({ call: [err] }), scripted()];
    await expect(svc.callTool('https://m.example', none, 'send_email', {})).rejects.toBe(err);
  });

  it('retries a write after "Not connected"', async () => {
    svc.queue = [
      scripted({ call: [new Error('Not connected')] }),
      scripted({ call: [{ content: [{ type: 'text', text: 'ok' }] }] }),
    ];
    expect(await svc.callTool('https://m.example', none, 'w', {})).toBe('ok');
  });

  it.each([401, 403])('never retries on HTTP %i, even for reads', async (code) => {
    const err = httpErr(code);
    svc.queue = [scripted({ list: [err] }), scripted()];
    await expect(svc.listTools('https://m.example', none)).rejects.toBe(err);
    expect(svc.createdFor).toHaveLength(1);
  });

  it('treats MCP ConnectionClosed / RequestTimeout as transport errors', async () => {
    svc.queue = [
      scripted({ list: [mcpErr(-32001)] }),
      scripted({ list: [{ tools: [{ name: 'ok' }] }] }),
    ];
    expect((await svc.listTools('https://m.example', none)).map((t) => t.name)).toEqual(['ok']);
  });

  it('does not reconnect on a protocol error from a live server and keeps the client cached', async () => {
    const live = scripted({ list: [mcpErr(-32602), { tools: [{ name: 'again' }] }] });
    svc.queue = [live];
    await expect(svc.listTools('https://m.example', none)).rejects.toMatchObject({ name: 'McpError' });
    expect(live.closed).toBe(0);
    expect((await svc.listTools('https://m.example', none)).map((t) => t.name)).toEqual(['again']);
    expect(svc.createdFor).toHaveLength(1);
  });

  it('does not reconnect on ToolExecutionError / UnsafeUrlError', async () => {
    const blocked = new UnsafeUrlError('private');
    const c = scripted({ call: [{ isError: true, content: [{ type: 'text', text: 'nope' }] }, blocked] });
    svc.queue = [c];
    await expect(svc.callTool('https://m.example', none, 'w', {})).rejects.toBeInstanceOf(ToolExecutionError);
    await expect(svc.callTool('https://m.example', none, 'w', {})).rejects.toBe(blocked);
    expect(c.closed).toBe(0);
  });
});

describe('McpClientService cache hygiene', () => {
  let svc: QueueService;
  const url = 'https://m.example';
  beforeEach(() => {
    svc = new QueueService();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keys the cache by credential: a different token gets its own client', async () => {
    svc.queue = [scripted(), scripted()];
    await svc.listTools(url, { type: 'bearer', token: 'a' });
    await svc.listTools(url, { type: 'bearer', token: 'b' });
    await svc.listTools(url, { type: 'bearer', token: 'a' });
    expect(svc.createdFor).toHaveLength(2);
  });

  it('does not keep the token in plain text in cache keys', async () => {
    svc.queue = [scripted()];
    await svc.listTools(url, { type: 'bearer', token: 'super-secret-token' });
    const keys = [...(svc as any).clients.keys()].join(' ');
    expect(keys).not.toContain('super-secret-token');
    expect(keys).toMatch(/^[0-9a-f]{64}$/);
  });

  it('closes the old client when the same connection comes back with a rotated token', async () => {
    const old = scripted();
    svc.queue = [old, scripted()];
    await svc.listTools(url, { type: 'bearer', token: 'v1' }, { connKey: 'conn-1' });
    await svc.listTools(url, { type: 'bearer', token: 'v2' }, { connKey: 'conn-1' });
    await Promise.resolve();
    await Promise.resolve();
    expect(old.closed).toBe(1);
  });

  it('a failed connect is not reused: the next call connects again', async () => {
    svc.queue = [new Error('ECONNREFUSED'), scripted({ list: [{ tools: [{ name: 'up' }] }] })];
    await expect(svc.listTools(url, { type: 'none' }, { connKey: 'c' })).rejects.toThrow('ECONNREFUSED');
    expect((svc as any).byConn.has('c')).toBe(false);
    expect((await svc.listTools(url, { type: 'none' }, { connKey: 'c' })).map((t) => t.name)).toEqual(['up']);
  });

  it('evictConnection closes that connection client and ignores unknown ids', async () => {
    const c = scripted();
    svc.queue = [c];
    await svc.listTools(url, { type: 'none' }, { connKey: 'conn-x' });
    await svc.evictConnection('unknown');
    expect(c.closed).toBe(0);
    await svc.evictConnection('conn-x');
    expect(c.closed).toBe(1);
    expect((svc as any).clients.size).toBe(0);
  });

  it('sweeps clients idle for more than 10 minutes on the next use', async () => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const idle = scripted();
    svc.queue = [idle, scripted()];
    await svc.listTools('https://idle.example', { type: 'none' });
    now += 11 * 60_000;
    await svc.listTools('https://other.example', { type: 'none' });
    await Promise.resolve();
    await Promise.resolve();
    expect(idle.closed).toBe(1);
    (Date.now as jest.Mock).mockRestore();
  });

  it('keeps recently used clients when sweeping', async () => {
    let now = 5_000_000;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const active = scripted();
    svc.queue = [active, scripted()];
    await svc.listTools('https://a.example', { type: 'none' });
    now += 5 * 60_000;
    await svc.listTools('https://b.example', { type: 'none' });
    await Promise.resolve();
    expect(active.closed).toBe(0);
    spy.mockRestore();
  });

  it('onModuleDestroy tolerates a client whose close throws', async () => {
    const c = scripted();
    c.close = async () => {
      throw new Error('already closed');
    };
    svc.queue = [c];
    await svc.listTools(url, { type: 'none' }, { connKey: 'k' });
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
    expect((svc as any).byConn.size).toBe(0);
  });
});
