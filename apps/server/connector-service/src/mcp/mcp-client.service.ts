import { createHash } from 'crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface McpAuth {
  type: 'bearer' | 'apikey' | 'none';
  token?: string;
}

/**
 * Minimal shape we rely on from the MCP SDK Client. Kept narrow so the unit
 * test can inject a fake via the protected createClient() seam.
 */
interface McpClientLike {
  listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: object }> }>;
  callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  close(): Promise<void>;
}

/**
 * Connects to remote MCP servers (Streamable HTTP transport) and exposes
 * listTools / callTool. Clients are cached per (url + token) hash and closed
 * on module destroy.
 */
@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private readonly clients = new Map<string, Promise<McpClientLike>>();

  async listTools(url: string, auth: McpAuth): Promise<McpTool[]> {
    const client = await this.getClient(url, auth);
    const res = await client.listTools();
    return (res.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    }));
  }

  async callTool(
    url: string,
    auth: McpAuth,
    name: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const client = await this.getClient(url, auth);
    const res = await client.callTool({ name, arguments: input ?? {} });
    return (res.content ?? [])
      .filter((c) => c.type === 'text' || typeof c.text === 'string')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
  }

  async onModuleDestroy(): Promise<void> {
    for (const [key, p] of this.clients.entries()) {
      try {
        const client = await p;
        await client.close();
      } catch (err) {
        this.logger.warn(`Failed to close MCP client ${key}: ${(err as Error).message}`);
      }
    }
    this.clients.clear();
  }

  private cacheKey(url: string, auth: McpAuth): string {
    return createHash('sha256')
      .update(`${url}|${auth.type}|${auth.token ?? ''}`)
      .digest('hex');
  }

  private getClient(url: string, auth: McpAuth): Promise<McpClientLike> {
    const key = this.cacheKey(url, auth);
    let existing = this.clients.get(key);
    if (!existing) {
      existing = this.createClient(url, auth);
      this.clients.set(key, existing);
    }
    return existing;
  }

  /**
   * Builds and connects a real MCP Client over Streamable HTTP. Overridden in
   * tests with a fake. Uses dynamic import because @modelcontextprotocol/sdk
   * is ESM-only and this service compiles to CommonJS.
   */
  protected async createClient(url: string, auth: McpAuth): Promise<McpClientLike> {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );

    const headers: Record<string, string> = {};
    if (auth.type === 'bearer' && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    } else if (auth.type === 'apikey' && auth.token) {
      headers['X-API-Key'] = auth.token;
    }

    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
    });
    const client = new Client(
      { name: 'pon-connector', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(transport);
    return client as unknown as McpClientLike;
  }
}
