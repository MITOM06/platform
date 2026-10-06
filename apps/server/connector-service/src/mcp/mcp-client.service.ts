import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ToolAnnotationsLike } from '../catalog/tool-classification';
import { clip, ToolExecutionError } from '../internal/tool-errors';
import { safeFetch, UnsafeUrlError } from '../security/url-guard';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
  /** MCP tool annotations (readOnlyHint drives the governance classification). */
  annotations?: ToolAnnotationsLike;
}

export interface McpAuth {
  type: 'bearer' | 'apikey' | 'none';
  token?: string;
}

export interface McpClientOptions {
  /**
   * Stable identity of the connection behind the client (connection / server
   * id). When the same connection comes back with a different token (refresh,
   * rotation) the client cached for the previous token is closed.
   */
  connKey?: string;
}

export type McpTransportKind = 'streamable' | 'sse';

/** Narrow view of the SDK Client so tests can inject fakes. */
export interface McpClientLike {
  listTools(
    params?: { cursor?: string },
    options?: { timeout?: number },
  ): Promise<{
    tools: Array<{
      name: string;
      description?: string;
      inputSchema?: object;
      annotations?: ToolAnnotationsLike;
    }>;
    nextCursor?: string;
  }>;
  callTool(
    params: { name: string; arguments: Record<string, unknown> },
    resultSchema?: unknown,
    options?: { timeout?: number },
  ): Promise<{ content?: Array<{ type?: string; text?: string }>; isError?: boolean }>;
  close(): Promise<void>;
}

interface CacheEntry {
  client: Promise<McpClientLike>;
  lastUsed: number;
  connKey?: string;
}

const IDLE_MS = 10 * 60_000;
const SWEEP_EVERY_MS = 60_000;
const CONNECT_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_MS = 10_000;
const CALL_TIMEOUT_MS = 60_000;
const MAX_TOOL_PAGES = 10;

/** HTTP status carried by an SDK transport error (StreamableHTTPError / SseError), if any. */
export function httpStatusOf(err: unknown): number | undefined {
  const e = err as { name?: string; code?: unknown } | null;
  if (!e || e.name === 'McpError') return undefined;
  return typeof e.code === 'number' && e.code >= 100 && e.code <= 599 ? e.code : undefined;
}

/** A failure of the connection/session itself (vs a protocol answer from a live server). */
function isTransportError(err: unknown): boolean {
  if (err instanceof ToolExecutionError || err instanceof UnsafeUrlError) return false;
  const e = err as { name?: string; code?: unknown } | null;
  if (e?.name === 'McpError') return e.code === -32000 || e.code === -32001; // ConnectionClosed / RequestTimeout
  return true;
}

/** The request provably never reached a live session, so even a write may be retried. */
function isUndelivered(err: unknown): boolean {
  const e = err as { message?: unknown; constructor?: { name?: string } } | null;
  if (e?.constructor?.name === 'StreamableHTTPError' && httpStatusOf(err) === 404) return true;
  return /\bNot connected\b/.test(String(e?.message ?? ''));
}

function authHeaders(auth: McpAuth): Record<string, string> {
  if (auth.type === 'bearer' && auth.token) return { Authorization: `Bearer ${auth.token}` };
  if (auth.type === 'apikey' && auth.token) return { 'X-API-Key': auth.token };
  return {};
}

function joinText(content?: Array<{ type?: string; text?: string }>): string {
  return (content ?? [])
    .filter((c) => c.type === 'text' || typeof c.text === 'string')
    .map((c) => c.text ?? '')
    .join('')
    .trim();
}

/**
 * Connects to remote MCP servers and exposes listTools / callTool.
 *
 * Clients are cached per (url + credential) and:
 *  - evicted when connecting fails (a failed promise is never reused);
 *  - dropped and re-created once on a transport/session error (writes are only
 *    retried when the request provably never reached the server);
 *  - closed when the same connection reappears with a rotated token;
 *  - closed after 10 minutes idle and on module destroy.
 *
 * Streamable HTTP is tried first, then the legacy SSE transport (servers such
 * as `https://mcp.notion.com/sse` only speak SSE); a path ending in `/sse`
 * reverses the order. Every request goes through the SSRF-guarded fetch.
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private readonly clients = new Map<string, CacheEntry>();
  private readonly byConn = new Map<string, string>();
  private lastSweep = 0;

  listTools(url: string, auth: McpAuth, opts: McpClientOptions = {}): Promise<McpTool[]> {
    return this.withClient(url, auth, opts, true, (c) => this.fetchTools(c));
  }

  callTool(
    url: string,
    auth: McpAuth,
    name: string,
    input: Record<string, unknown>,
    opts: McpClientOptions = {},
  ): Promise<string> {
    return this.withClient(url, auth, opts, false, async (client) => {
      const res = await client.callTool({ name, arguments: input ?? {} }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      });
      const text = joinText(res.content);
      if (res.isError) {
        throw new ToolExecutionError('TOOL_FAILED', clip(text || 'The tool reported an error.', 1000));
      }
      return text;
    });
  }

  /** One-shot tool discovery (custom MCP preview) — never cached, always closed. */
  async discoverTools(url: string, auth: McpAuth): Promise<McpTool[]> {
    const client = await this.createClient(url, auth);
    try {
      return await this.fetchTools(client);
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  /** Close the cached client of a connection (e.g. after it was deleted). */
  async evictConnection(connKey: string): Promise<void> {
    const key = this.byConn.get(connKey);
    if (key) await this.evict(key);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.clients.keys()].map((key) => this.evict(key)));
    this.clients.clear();
    this.byConn.clear();
  }

  private async withClient<T>(
    url: string,
    auth: McpAuth,
    opts: McpClientOptions,
    idempotent: boolean,
    op: (client: McpClientLike) => Promise<T>,
  ): Promise<T> {
    const key = this.cacheKey(url, auth);
    const client = await this.getClient(key, url, auth, opts.connKey);
    try {
      return await op(client);
    } catch (err) {
      if (!isTransportError(err)) throw err;
      await this.evict(key);
      const status = httpStatusOf(err);
      const retryable = status !== 401 && status !== 403 && (idempotent || isUndelivered(err));
      if (!retryable) throw err;
      this.logger.warn(`MCP session error (${status ?? (err as Error).name}); reconnecting once`);
      return op(await this.getClient(key, url, auth, opts.connKey));
    }
  }

  private getClient(key: string, url: string, auth: McpAuth, connKey?: string): Promise<McpClientLike> {
    this.sweepIdle();
    const now = Date.now();
    const existing = this.clients.get(key);
    if (existing) {
      existing.lastUsed = now;
      return existing.client;
    }
    if (connKey) {
      const previous = this.byConn.get(connKey);
      if (previous && previous !== key) void this.evict(previous);
      this.byConn.set(connKey, key);
    }
    const entry: CacheEntry = { client: this.createClient(url, auth), lastUsed: now, connKey };
    this.clients.set(key, entry);
    // A failed connect must not poison the cache.
    entry.client.catch(() => {
      if (this.clients.get(key) !== entry) return;
      this.clients.delete(key);
      if (connKey && this.byConn.get(connKey) === key) this.byConn.delete(connKey);
    });
    return entry.client;
  }

  private async evict(key: string): Promise<void> {
    const entry = this.clients.get(key);
    if (!entry) return;
    this.clients.delete(key);
    if (entry.connKey && this.byConn.get(entry.connKey) === key) this.byConn.delete(entry.connKey);
    try {
      const client = await entry.client;
      await client.close();
    } catch {
      // failed connect or already closed
    }
  }

  private sweepIdle(): void {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    for (const [key, entry] of this.clients) {
      if (now - entry.lastUsed > IDLE_MS) void this.evict(key);
    }
  }

  private cacheKey(url: string, auth: McpAuth): string {
    return createHash('sha256').update(`${url}|${auth.type}|${auth.token ?? ''}`).digest('hex');
  }

  private async fetchTools(client: McpClientLike): Promise<McpTool[]> {
    const out: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page++) {
      const res = await client.listTools(cursor ? { cursor } : undefined, { timeout: LIST_TIMEOUT_MS });
      for (const t of res.tools ?? []) {
        out.push({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
          ...(t.annotations ? { annotations: t.annotations } : {}),
        });
      }
      cursor = res.nextCursor;
      if (!cursor) break;
    }
    return out;
  }

  /** Connect over the preferred transport, falling back to the other one. */
  protected async createClient(url: string, auth: McpAuth): Promise<McpClientLike> {
    const target = new URL(url);
    const headers = authHeaders(auth);
    const order: McpTransportKind[] = /\/sse\/?$/i.test(target.pathname)
      ? ['sse', 'streamable']
      : ['streamable', 'sse'];
    let lastErr: unknown;
    for (const kind of order) {
      try {
        return await this.connect(kind, target, headers);
      } catch (err) {
        lastErr = err;
        const status = httpStatusOf(err);
        // Bad credentials or a blocked target fail the same way on either transport.
        if (status === 401 || status === 403 || err instanceof UnsafeUrlError) throw err;
      }
    }
    throw lastErr;
  }

  /**
   * Connect a real SDK client over one transport (test seam). Dynamic imports:
   * the SDK is loaded lazily so tests and boots that never reach a remote MCP
   * server do not pay for it.
   */
  protected async connect(
    kind: McpTransportKind,
    url: URL,
    headers: Record<string, string>,
  ): Promise<McpClientLike> {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const transport =
      kind === 'sse'
        ? new (await import('@modelcontextprotocol/sdk/client/sse.js')).SSEClientTransport(url, {
            requestInit: { headers },
            fetch: safeFetch,
          })
        : new (await import('@modelcontextprotocol/sdk/client/streamableHttp.js')).StreamableHTTPClientTransport(
            url,
            { requestInit: { headers }, fetch: safeFetch },
          );
    const client = new Client({ name: 'pon-connector', version: '1.0.0' }, { capabilities: {} });
    try {
      await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
    } catch (err) {
      await client.close().catch(() => undefined);
      throw err;
    }
    return client as unknown as McpClientLike;
  }
}
