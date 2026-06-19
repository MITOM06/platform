import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { McpAuth, McpClientService } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import {
  CustomMcpServer,
  CustomMcpServerDocument,
} from '../connections/schemas/custom-mcp-server.schema';

export interface InternalToolDef {
  name: string; // mcp__<provider>__<tool>
  description: string;
  input_schema: object;
}

const PREFIX = 'mcp__';
const SEP = '__';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(CustomMcpServer.name)
    private readonly customModel: Model<CustomMcpServerDocument>,
    private readonly vault: TokenVaultService,
    private readonly mcp: McpClientService,
  ) {}

  /**
   * Aggregate dynamic tools across the user's active connections and custom
   * MCP servers, namespaced `mcp__<provider>__<tool>`. A failing source is
   * logged and skipped so one offline integration never blocks the rest.
   */
  async getTools(userId: string): Promise<{ tools: InternalToolDef[] }> {
    const tools: InternalToolDef[] = [];

    const conns = await this.connModel
      .find({ userId, status: 'active' })
      .lean();
    for (const conn of conns) {
      try {
        const auth = this.authForConnection(conn);
        const list = await this.mcp.listTools(conn.mcpUrl, auth);
        for (const t of list) {
          tools.push({
            name: `${PREFIX}${conn.provider}${SEP}${t.name}`,
            description: t.description,
            input_schema: t.inputSchema,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Skipping tools for ${conn.provider} (user ${userId}): ${(err as Error).message}`,
        );
      }
    }

    await this.appendCustomTools(userId, tools);
    return { tools };
  }

  private async appendCustomTools(
    userId: string,
    tools: InternalToolDef[],
  ): Promise<void> {
    let customs: any[] = [];
    try {
      customs = await this.customModel.find({ userId }).lean();
    } catch (err) {
      this.logger.warn(`Custom MCP lookup failed: ${(err as Error).message}`);
      return;
    }
    for (const srv of customs) {
      try {
        const credential = srv.encryptedCredential
          ? this.vault.decrypt(srv.encryptedCredential)
          : undefined;
        const auth = this.authForType(srv.authType, credential);
        const list = await this.mcp.listTools(srv.url, auth);
        const provider = `custom:${String((srv as any)._id)}`;
        for (const t of list) {
          tools.push({
            name: `${PREFIX}${provider}${SEP}${t.name}`,
            description: t.description,
            input_schema: t.inputSchema,
          });
        }
      } catch (err) {
        this.logger.warn(
          `Skipping custom MCP ${srv.name}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Parse `mcp__<provider>__<tool>`, resolve the connection (built-in or
   * custom:<id>), decrypt the token, and dispatch to the MCP server.
   */
  async callTool(
    userId: string,
    name: string,
    input: Record<string, unknown>,
  ): Promise<{ result: string }> {
    const parsed = this.parseName(name);
    if (!parsed) {
      return { result: `Tool error: malformed tool name ${name}` };
    }
    const { provider, tool } = parsed;

    try {
      if (provider.startsWith('custom:')) {
        return { result: await this.callCustom(userId, provider, tool, input) };
      }
      return { result: await this.callBuiltin(userId, provider, tool, input) };
    } catch (err) {
      this.logger.error(`callTool failed for ${name}`, err as Error);
      return { result: `Tool error: ${(err as Error).message}` };
    }
  }

  private async callBuiltin(
    userId: string,
    provider: string,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const conn = await this.connModel
      .findOne({ userId, provider, status: 'active' })
      .lean();
    if (!conn) return `Tool error: no active ${provider} connection`;
    const auth = this.authForConnection(conn);
    const out = await this.mcp.callTool(conn.mcpUrl, auth, tool, input);
    await this.connModel.updateOne(
      { _id: conn._id },
      { $set: { lastUsedAt: new Date() } },
    );
    return out;
  }

  private async callCustom(
    userId: string,
    provider: string,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const id = provider.slice('custom:'.length);
    const srv = await this.customModel.findById(id).lean();
    if (!srv || String(srv.userId) !== userId) {
      return `Tool error: custom MCP not found`;
    }
    const credential = srv.encryptedCredential
      ? this.vault.decrypt(srv.encryptedCredential)
      : undefined;
    const auth = this.authForType(srv.authType, credential);
    return this.mcp.callTool(srv.url, auth, tool, input);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private parseName(name: string): { provider: string; tool: string } | null {
    if (!name.startsWith(PREFIX)) return null;
    const rest = name.slice(PREFIX.length);
    const idx = rest.indexOf(SEP);
    if (idx <= 0) return null;
    return { provider: rest.slice(0, idx), tool: rest.slice(idx + SEP.length) };
  }

  private authForConnection(conn: UserConnection): McpAuth {
    const tokens = JSON.parse(this.vault.decrypt(conn.encryptedTokens));
    return { type: 'bearer', token: tokens.access_token };
  }

  private authForType(authType: string, credential?: string): McpAuth {
    if (authType === 'oauth2') return { type: 'bearer', token: credential };
    if (authType === 'apikey') return { type: 'apikey', token: credential };
    return { type: 'none' };
  }
}
