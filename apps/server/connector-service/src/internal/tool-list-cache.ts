import { McpTool } from '../mcp/mcp-client.service';
import { withTimeout } from '../common/with-timeout';

interface Entry {
  tools: McpTool[];
  fetchedAt: number;
}

export interface ToolListCacheOptions {
  /** Serve from cache without refetching while younger than this. */
  freshMs?: number;
  /** On fetch failure/timeout, fall back to a cached list younger than this. */
  staleMs?: number;
  maxEntries?: number;
}

/**
 * Per-source cache of remote tool lists.
 *
 * ai-service gives `GET /internal/tools` 5 s in total. Remote MCP servers are
 * listed in parallel, each bounded by a timeout; a slow server's fetch keeps
 * running in the background and fills the cache for the next request, and a
 * recently cached list is served if it fails. The same cache answers the
 * call-time lookup (annotations + original remote name) without a second
 * round trip. Keys include a credential fingerprint, so a reconnect or token
 * rotation naturally starts a fresh entry.
 */
export class ToolListCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<McpTool[]>>();
  private readonly freshMs: number;
  private readonly staleMs: number;
  private readonly maxEntries: number;

  constructor(opts: ToolListCacheOptions = {}) {
    this.freshMs = opts.freshMs ?? 60_000;
    this.staleMs = opts.staleMs ?? 15 * 60_000;
    this.maxEntries = opts.maxEntries ?? 1_000;
  }

  async get(key: string, fetcher: () => Promise<McpTool[]>, timeoutMs: number): Promise<McpTool[]> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && now - hit.fetchedAt < this.freshMs) return hit.tools;

    let flight = this.inflight.get(key);
    if (!flight) {
      flight = Promise.resolve()
        .then(fetcher)
        .then((tools) => {
          this.set(key, tools);
          return tools;
        });
      this.inflight.set(key, flight);
      const settled = flight;
      const clear = () => {
        if (this.inflight.get(key) === settled) this.inflight.delete(key);
      };
      settled.then(clear, clear);
    }
    try {
      return await withTimeout(flight, timeoutMs, 'tool listing');
    } catch (err) {
      if (hit && now - hit.fetchedAt < this.staleMs) return hit.tools;
      throw err;
    }
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  private set(key: string, tools: McpTool[]): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.delete(key);
    this.entries.set(key, { tools, fetchedAt: Date.now() });
  }
}
