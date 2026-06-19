import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToolDefinition } from './tool.interface';

const TIMEOUT_MS = 5000;

interface ConnectorTool {
  name: string;
  description: string;
  input_schema: ToolDefinition['input_schema'];
}

/**
 * Talks to connector-service's internal tools API to fetch per-user dynamic
 * MCP tools and dispatch tool calls. Graceful-degrade: any network/timeout/
 * non-2xx error means `getTools` resolves to `[]` (logs one warning, never
 * throws) and `callTool` returns a fixed error string.
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

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async getTools(userId: string): Promise<ToolDefinition[]> {
    try {
      const url = `${this.baseUrl}/internal/tools?userId=${encodeURIComponent(userId)}`;
      const res = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'x-internal-key': this.internalKey },
      });
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
    try {
      const url = `${this.baseUrl}/internal/tools/call`;
      const res = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'x-internal-key': this.internalKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId, name, input }),
      });
      if (!res.ok) {
        this.logger.warn(`connector callTool returned ${res.status}`);
        return 'Tool error: connector unavailable';
      }
      const body = (await res.json()) as { result?: string };
      return body.result ?? '';
    } catch (err) {
      this.logger.warn(`connector callTool unavailable (${(err as Error).message})`);
      return 'Tool error: connector unavailable';
    }
  }
}
