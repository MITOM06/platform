import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToolDefinition } from './tool.interface';
import { isSensitiveTool } from '../ai/injection-guard';
import { providerOf } from './tool-names';

const DEFAULT_READ_TIMEOUT_MS = 5_000;
const DEFAULT_REMOTE_READ_TIMEOUT_MS = 30_000;
const DEFAULT_WRITE_TIMEOUT_MS = 30_000;

/**
 * Catalog providers connector-service runs on its own REST adapters (Google,
 * Notion). Any other provider — an MCP-directory slug or a `custom_<id>` server —
 * is a third-party remote MCP server.
 */
const IN_HOUSE_PROVIDERS: ReadonlySet<string> = new Set(['gmail', 'calendar', 'drive', 'notion']);

function isRemoteMcpTool(name: string): boolean {
  const provider = providerOf(name);
  return provider !== null && !IN_HOUSE_PROVIDERS.has(provider);
}

/** Returned to the model when a write's outcome is unknown — it must not blindly retry. */
export const WRITE_TIMEOUT_RESULT =
  'Tool error: the connector did not confirm this action in time. It may still have ' +
  'completed — do NOT retry it automatically; tell the user to check before trying again.';

/**
 * One item of connector-service `GET /internal/tools`. `sensitive` and
 * `actionGroup` are governance metadata for ai-service only — they are NOT
 * part of an Anthropic tool definition and must never be forwarded there.
 */
interface ConnectorTool {
  name: string;
  description: string;
  input_schema: ToolDefinition['input_schema'];
  sensitive?: unknown;
  actionGroup?: unknown;
}

export interface CallToolOptions {
  /**
   * Treat the call as a write (long timeout, "outcome unknown" on timeout)
   * even when the name has no write marker — e.g. a connector tool flagged
   * `sensitive` whose verb the local heuristic does not know.
   */
  write?: boolean;
}

const MAX_WITHHELD = 50;

/** Valid `{name: 'mcp__…', reason: 'role'}` items of connector-service `withheld` (older services send none). */
function roleWithheldNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (w): w is { name: string } =>
        !!w &&
        typeof w === 'object' &&
        (w as { reason?: unknown }).reason === 'role' &&
        typeof (w as { name?: unknown }).name === 'string' &&
        (w as { name: string }).name.startsWith('mcp__'),
    )
    .slice(0, MAX_WITHHELD)
    .map((w) => w.name);
}

class ConnectorTimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = 'ConnectorTimeoutError';
  }
}

/**
 * Talks to connector-service's internal tools API to fetch per-user dynamic
 * MCP tools and dispatch tool calls. Graceful-degrade: any network/timeout/
 * non-2xx error means `getTools` resolves to `[]` (logs one warning, never
 * throws) and `callTool` returns a fixed error string.
 *
 * Timeouts: listing and read-only calls get the short read budget; state-
 * changing calls (send/create/update/…, `isSensitiveTool`) get the long write
 * budget. Aborting a send after 5 s reported failure for an email the provider
 * then delivered, and the model retried it — a duplicate send. Reads on a
 * third-party remote MCP server get their own longer budget: GitMCP's
 * `search_repo_docs` takes ~16 s, so a custom server's first chat failed with
 * "connector unavailable" (connector-service itself allows such a call 60 s).
 */
@Injectable()
export class McpConnectorClient {
  private readonly logger = new Logger(McpConnectorClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('config.connector.internalUrl') ?? 'http://localhost:3003'
    );
  }

  private get internalKey(): string {
    return this.config.get<string>('config.connector.internalApiKey') ?? '';
  }

  private timeoutFor(toolName: string | null, write = false): number {
    if (write || (toolName !== null && isSensitiveTool(toolName))) {
      return this.config.get<number>('config.connector.writeTimeoutMs') ?? DEFAULT_WRITE_TIMEOUT_MS;
    }
    if (toolName !== null && isRemoteMcpTool(toolName)) {
      return (
        this.config.get<number>('config.connector.remoteReadTimeoutMs') ?? DEFAULT_REMOTE_READ_TIMEOUT_MS
      );
    }
    return this.config.get<number>('config.connector.readTimeoutMs') ?? DEFAULT_READ_TIMEOUT_MS;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) throw new ConnectorTimeoutError(timeoutMs);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The member's connector tools. `withheldSink`, when given, receives the names of
   * the tools connector-service holds back because of the member's ROLE (`withheld`,
   * reason `role`) — connected apps whose write actions this role may not run.
   */
  async getTools(userId: string, withheldSink?: string[]): Promise<ToolDefinition[]> {
    try {
      const url = `${this.baseUrl}/internal/tools?userId=${encodeURIComponent(userId)}`;
      const res = await this.fetchWithTimeout(
        url,
        { method: 'GET', headers: { 'x-internal-key': this.internalKey } },
        this.timeoutFor(null),
      );
      if (!res.ok) {
        this.logger.warn(`connector getTools returned ${res.status} — degrading to []`);
        return [];
      }
      const body = (await res.json()) as { tools?: ConnectorTool[]; withheld?: unknown };
      const tools = body.tools ?? [];
      if (withheldSink) withheldSink.push(...roleWithheldNames(body.withheld));
      // Whitelist the fields: `actionGroup` (and anything else connector-service
      // adds later) is dropped here; `sensitive` is kept INTERNALLY for the
      // confirmation gate. An older connector without the flag falls back to
      // the local name heuristic, so a write is never silently "not sensitive".
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
        sensitive: typeof t.sensitive === 'boolean' ? t.sensitive : isSensitiveTool(t.name),
      }));
    } catch (err) {
      this.logger.warn(
        `connector getTools unavailable (${(err as Error).message}) — degrading to []`,
      );
      return [];
    }
  }

  async callTool(
    userId: string,
    name: string,
    input: Record<string, unknown>,
    opts: CallToolOptions = {},
  ): Promise<string> {
    const isWrite = opts.write === true || isSensitiveTool(name);
    try {
      const url = `${this.baseUrl}/internal/tools/call`;
      const res = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'x-internal-key': this.internalKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ userId, name, input }),
        },
        this.timeoutFor(name, isWrite),
      );
      if (!res.ok) {
        this.logger.warn(`connector callTool returned ${res.status}`);
        return 'Tool error: connector unavailable';
      }
      const body = (await res.json()) as { result?: string };
      return body.result ?? '';
    } catch (err) {
      this.logger.warn(`connector callTool ${name} unavailable (${(err as Error).message})`);
      // A write that timed out may have happened — say so instead of "failed".
      if (isWrite && err instanceof ConnectorTimeoutError) return WRITE_TIMEOUT_RESULT;
      return 'Tool error: connector unavailable';
    }
  }
}
