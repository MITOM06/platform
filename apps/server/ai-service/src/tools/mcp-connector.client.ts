import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToolDefinition } from './tool.interface';
import { isSensitiveTool } from '../ai/injection-guard';

const DEFAULT_READ_TIMEOUT_MS = 5_000;
const DEFAULT_WRITE_TIMEOUT_MS = 30_000;

/** Returned to the model when a write's outcome is unknown — it must not blindly retry. */
export const WRITE_TIMEOUT_RESULT =
  'Tool error: the connector did not confirm this action in time. It may still have ' +
  'completed — do NOT retry it automatically; tell the user to check before trying again.';

interface ConnectorTool {
  name: string;
  description: string;
  input_schema: ToolDefinition['input_schema'];
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
 * then delivered, and the model retried it — a duplicate send.
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

  private timeoutFor(toolName: string | null): number {
    if (toolName !== null && isSensitiveTool(toolName)) {
      return this.config.get<number>('config.connector.writeTimeoutMs') ?? DEFAULT_WRITE_TIMEOUT_MS;
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

  async getTools(userId: string): Promise<ToolDefinition[]> {
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
      const body = (await res.json()) as { tools?: ConnectorTool[] };
      const tools = body.tools ?? [];
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
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
  ): Promise<string> {
    const isWrite = isSensitiveTool(name);
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
        this.timeoutFor(name),
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
