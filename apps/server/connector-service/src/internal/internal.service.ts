import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Capability } from '@platform/database';
import { AuditService } from '../audit/audit.service';
import {
  ALL_ACTION_GROUPS,
  classifyToolActionGroup,
  isSensitiveTool,
} from '../catalog/catalog';
import {
  AdapterRegistryService,
} from '../adapters/adapter-registry.service';
import { ConnectionLike } from '../adapters/provider-adapter.interface';
import { PermResolverService } from './perm-resolver.service';
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

/**
 * Aggregates and executes a user's connector tools, namespaced
 * `mcp__<provider>__<tool>`. Tool I/O is delegated to a {@link ProviderAdapter}
 * resolved per provider (remote MCP for Notion/custom, Google REST for
 * Gmail/Calendar) — this service owns aggregation, namespacing, the sensitive
 * gate, audit, and `lastUsedAt`.
 */
@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(CustomMcpServer.name)
    private readonly customModel: Model<CustomMcpServerDocument>,
    private readonly perms: PermResolverService,
    private readonly audit: AuditService,
    private readonly adapters: AdapterRegistryService,
  ) {}

  /** Bare tool name from a namespaced `mcp__<provider>__<tool>` def. */
  private bareToolName(namespaced: string): string {
    const parsed = this.parseName(namespaced);
    return parsed ? parsed.tool : namespaced;
  }

  /**
   * Aggregate dynamic tools across the user's active connections and custom
   * MCP servers, namespaced `mcp__<provider>__<tool>`. A failing source is
   * logged and skipped so one offline integration never blocks the rest.
   */
  async getTools(userId: string): Promise<{ tools: InternalToolDef[] }> {
    const tools: InternalToolDef[] = [];

    // Resolve the member's capability set ONCE; used to filter sensitive tools.
    const userPerms = await this.perms.resolvePerms(userId);
    const mayRunSensitive = userPerms.has(Capability.RUN_SENSITIVE_SKILL);

    const conns = await this.connModel
      .find({
        $or: [{ userId }, { scope: 'workspace' }],
        status: 'active',
      })
      .lean();
    for (const conn of conns) {
      try {
        const adapter = this.adapters.forProvider(conn.provider);
        const list = await adapter.listTools(this.builtinConn(conn));
        // Per-connection action-group gate: only expose tools whose action
        // (view/create/edit/delete) is granted on this connection.
        const granted = conn.actionGroups ?? ALL_ACTION_GROUPS;
        for (const t of list) {
          if (!granted.includes(classifyToolActionGroup(t.name))) continue;
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

    // Permission-aware exposure: drop sensitive-tagged tools unless the member
    // holds RUN_SENSITIVE_SKILL. Done after aggregation so it covers built-in
    // AND custom MCP tools uniformly.
    const filtered = mayRunSensitive
      ? tools
      : tools.filter((t) => !isSensitiveTool(this.bareToolName(t.name)));
    return { tools: filtered };
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
      const provider = `custom:${String(srv._id)}`;
      try {
        const adapter = this.adapters.forProvider(provider);
        const list = await adapter.listTools(this.customConn(srv));
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
   * custom:<id>), and dispatch via the provider adapter. Re-checks the sensitive
   * gate at execution time and audits successful sensitive runs.
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

    // Defense in depth: never rely on the list filter alone. Re-check the
    // sensitive gate at execution time.
    const sensitive = isSensitiveTool(tool);
    if (sensitive) {
      const userPerms = await this.perms.resolvePerms(userId);
      if (!userPerms.has(Capability.RUN_SENSITIVE_SKILL)) {
        return { result: `Tool error: not permitted (sensitive skill)` };
      }
    }

    try {
      const result = provider.startsWith('custom:')
        ? await this.callCustom(userId, provider, tool, input)
        : await this.callBuiltin(userId, provider, tool, input);
      if (sensitive) {
        await this.audit.record({
          actorId: userId,
          action: 'sensitive_skill.run',
          targetType: 'tool',
          targetId: name,
          meta: { provider, tool },
        });
      }
      return { result };
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
    // Resolve the connection with the SAME visibility as getTools: the caller's
    // own connection OR a shared workspace-scoped one (owned by any member). A
    // member invoking a workspace connector tool owned by an admin must resolve
    // that shared doc — an owner-only findOne would always miss it and return
    // "no active connection". Prefer the caller's own connection when both exist.
    const conns = await this.connModel
      .find({
        $or: [{ userId }, { scope: 'workspace' }],
        provider,
        status: 'active',
      })
      .lean();
    const conn = conns.find((c) => c.userId === userId) ?? conns[0];
    if (!conn) return `Tool error: no active ${provider} connection`;
    // Defense in depth: re-check the action-group grant at execution time so a
    // stale/forged tool list can't bypass the permission the user set.
    const granted = conn.actionGroups ?? ALL_ACTION_GROUPS;
    const group = classifyToolActionGroup(tool);
    if (!granted.includes(group)) {
      return `Tool error: not permitted (${group} access not granted for ${provider})`;
    }
    const adapter = this.adapters.forProvider(provider);
    const out = await adapter.callTool(this.builtinConn(conn), tool, input);
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
    const adapter = this.adapters.forProvider(provider);
    return adapter.callTool(this.customConn(srv), tool, input);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private builtinConn(conn: any): ConnectionLike {
    return {
      provider: conn.provider,
      mcpUrl: conn.mcpUrl,
      encryptedTokens: conn.encryptedTokens,
      encryptedClientCreds: conn.encryptedClientCreds,
      tokenEndpoint: conn.tokenEndpoint,
      _id: conn._id,
    };
  }

  private customConn(srv: any): ConnectionLike {
    return {
      provider: `custom:${String(srv._id)}`,
      url: srv.url,
      authType: srv.authType,
      encryptedCredential: srv.encryptedCredential,
      _id: srv._id,
    };
  }

  private parseName(name: string): { provider: string; tool: string } | null {
    if (!name.startsWith(PREFIX)) return null;
    const rest = name.slice(PREFIX.length);
    const idx = rest.indexOf(SEP);
    if (idx <= 0) return null;
    return { provider: rest.slice(0, idx), tool: rest.slice(idx + SEP.length) };
  }
}
