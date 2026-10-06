import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Capability } from '@platform/database';
import { AuditService } from '../audit/audit.service';
import {
  ActionGroup,
  ALL_ACTION_GROUPS,
  classifyTool,
  ToolAnnotationsLike,
  ToolClassification,
} from '../catalog/catalog';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { ConnectionLike } from '../adapters/provider-adapter.interface';
import { envInt, TimeoutError } from '../common/with-timeout';
import { ConnectorPolicy, skillGateAllows } from '../governance/connector-policy';
import { ConnectorPolicyService } from '../governance/connector-policy.service';
import { httpStatusOf, McpTool } from '../mcp/mcp-client.service';
import { UnsafeUrlError } from '../security/url-guard';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import {
  CustomMcpServer,
  CustomMcpServerDocument,
} from '../connections/schemas/custom-mcp-server.schema';
import { pickConnections } from './connection-selection';
import { MemberAccess, PermResolverService } from './perm-resolver.service';
import { clip, httpFailure, toolError, ToolExecutionError } from './tool-errors';
import { ToolListCache } from './tool-list-cache';
import {
  buildToolName,
  customProviderId,
  customServerIdOf,
  exposedToolSegment,
  isCustomProvider,
  parseToolName,
} from './tool-naming';

export interface InternalToolDef {
  name: string; // mcp__<provider>__<tool>
  description: string;
  input_schema: object;
  /**
   * True for every tool that is not read-only under the governance
   * classification (all writes, sensitive or not). ai-service holds these for
   * an explicit in-chat user confirmation before calling them.
   */
  sensitive: boolean;
  /** Action group the tool needs on the connection: view | create | edit | delete. */
  actionGroup: ActionGroup;
}

/** Who is asking: ai-service's tool loop, or a Bot Factory assistant via `/mcp`. */
export type ToolChannel = 'ai' | 'bot';

/** Refusal code for a write requested by a channel that cannot ask the user to confirm. */
export const SENSITIVE_ACTION_REQUIRES_CONFIRMATION = 'SENSITIVE_ACTION_REQUIRES_CONFIRMATION';

export interface ToolCallOutcome {
  result: string;
  /** Set only when the call was refused before execution for a reason the transport must surface. */
  refusal?: typeof SENSITIVE_ACTION_REQUIRES_CONFIRMATION;
}

interface ToolSource {
  kind: 'builtin' | 'custom';
  /** Provider segment of the exposed tool names. */
  provider: string;
  conn: ConnectionLike;
  /** Action groups granted on the connection (custom servers: all). */
  granted: readonly string[];
  cacheKey: string;
  docId: unknown;
}

interface Access {
  member: MemberAccess;
  policy: ConnectorPolicy;
  /** Enabled skills — only for the bot channel (ai-service gates skills itself). */
  skills: string[] | null;
  channel: ToolChannel;
}

/** Classification of a tool plus, when it may not run, why. */
interface Verdict {
  cls: ToolClassification;
  denied?: string;
}

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);

/**
 * Aggregates and executes a member's connector tools, namespaced
 * `mcp__<provider>__<tool>` (see tool-naming.ts). Tool I/O is delegated to a
 * provider adapter; this service owns governance, naming, de-duplication,
 * audit and `lastUsedAt`.
 *
 * Governance is evaluated live on every list AND call (never only at connect
 * time): member active, workspace allow-list, AI `allowedConnectors`,
 * directory availability, ADD_CUSTOM_MCP for custom servers, the per-connection
 * action-group grant, RUN_SENSITIVE_SKILL for writes (fail-closed tool
 * classification) and — for the Bot Factory channel — USE_PERSONAL_ASSISTANT
 * plus the action-skill gate.
 */
@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);
  private readonly toolCache = new ToolListCache();
  /** Per-source listing budget; ai-service gives the whole request 5 s. */
  private readonly listTimeoutMs = envInt(process.env.TOOL_LIST_TIMEOUT_MS, 3_500, 100, 30_000);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(CustomMcpServer.name)
    private readonly customModel: Model<CustomMcpServerDocument>,
    private readonly perms: PermResolverService,
    private readonly audit: AuditService,
    private readonly adapters: AdapterRegistryService,
    private readonly policyService: ConnectorPolicyService,
  ) {}

  // ── Listing ───────────────────────────────────────────────────────────────

  async getTools(userId: string, channel: ToolChannel = 'ai'): Promise<{ tools: InternalToolDef[] }> {
    const access = await this.loadAccess(userId, channel);
    if (!access) return { tools: [] };
    const sources = await this.visibleSources(userId, access);
    // Parallel, each bounded: one slow server no longer empties the whole list.
    const lists = await Promise.all(sources.map((s) => this.listSource(s, userId)));

    const tools: InternalToolDef[] = [];
    const seen = new Set<string>();
    sources.forEach((source, i) => {
      for (const t of lists[i]) {
        const verdict = this.permits(source, t.name, t.annotations, access);
        if (verdict.denied) continue;
        const sensitive = InternalService.needsConfirmation(verdict.cls);
        // Bot Factory cannot show PON's confirmation card: read-only tools only.
        if (sensitive && channel === 'bot') continue;
        const name = buildToolName(source.provider, t.name);
        if (!name) {
          this.logger.warn(`Dropping a ${source.provider} tool: provider id leaves no room for a valid name`);
          continue;
        }
        if (seen.has(name)) {
          this.logger.warn(`Dropping duplicate tool name ${name}`);
          continue;
        }
        seen.add(name);
        tools.push({
          name,
          description: t.description,
          input_schema: t.inputSchema,
          sensitive,
          actionGroup: verdict.cls.group,
        });
      }
    });
    return { tools };
  }

  private async visibleSources(userId: string, access: Access): Promise<ToolSource[]> {
    const [conns, customs] = await Promise.all([
      this.connModel.find({ $or: [{ userId }, { scope: 'workspace' }], status: 'active' }).lean(),
      this.ownCustomServers(userId, access),
    ]);
    const picked = pickConnections(conns as any[], userId).filter((c) =>
      this.providerAllowed(c.provider, access),
    );
    const usable = await this.policyService.usableProviders(picked.map((c) => c.provider));
    return [
      ...picked.filter((c) => usable.has(c.provider)).map((c) => this.builtinSource(c)),
      ...customs.map((s) => this.customSource(s)),
    ];
  }

  private async ownCustomServers(userId: string, access: Access): Promise<any[]> {
    if (!access.member.perms.has(Capability.ADD_CUSTOM_MCP)) return [];
    try {
      const docs = await this.customModel.find({ userId }).lean();
      return docs.filter((s) => this.providerAllowed(customProviderId(String(s._id)), access));
    } catch (err) {
      this.logger.warn(`Custom MCP lookup failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async listSource(source: ToolSource, userId: string): Promise<McpTool[]> {
    try {
      return await this.fetchTools(source);
    } catch (err) {
      this.logger.warn(
        `Skipping tools for ${source.provider} (user ${userId}): ${(err as Error)?.message ?? err}`,
      );
      return [];
    }
  }

  private fetchTools(source: ToolSource): Promise<McpTool[]> {
    const adapter = this.adapters.forProvider(source.provider);
    return this.toolCache.get(source.cacheKey, () => adapter.listTools(source.conn), this.listTimeoutMs);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Resolve `mcp__<provider>__<tool>` (the legacy `custom:<id>` provider form
   * is still accepted), re-run every gate on the resolved connection and
   * dispatch via the provider adapter. Sensitive runs are audited.
   */
  async callTool(
    userId: string,
    name: string,
    input: Record<string, unknown>,
    channel: ToolChannel = 'ai',
  ): Promise<ToolCallOutcome> {
    const parsed = parseToolName(name);
    if (!parsed) return { result: toolError('INVALID_TOOL', 'Malformed tool name.') };
    const { provider } = parsed;

    const access = await this.loadAccess(userId, channel);
    if (!access) {
      return { result: toolError('NOT_PERMITTED', 'Not permitted: connector tools are unavailable for this member.') };
    }
    if (!this.providerAllowed(provider, access)) {
      return { result: toolError('NOT_PERMITTED', `Not permitted: the ${provider} connector is not allowed.`) };
    }
    const source = isCustomProvider(provider)
      ? await this.resolveCustom(userId, provider, access)
      : await this.resolveBuiltin(userId, provider);
    if (typeof source === 'string') return { result: source };

    let tool: McpTool | null;
    try {
      tool = await this.resolveTool(source, parsed.tool);
    } catch (err) {
      return { result: this.renderError(source.provider, err) };
    }
    if (!tool) {
      return {
        result: toolError('UNKNOWN_TOOL', `The ${provider} connector has no tool named ${clip(parsed.tool, 64)}.`),
      };
    }

    if (channel === 'bot' && InternalService.needsConfirmation(classifyTool(tool.name, tool.annotations))) {
      return {
        result: toolError(
          'NOT_PERMITTED',
          'This action changes data and needs the user to confirm it in PON chat; it cannot run from an external assistant.',
        ),
        refusal: SENSITIVE_ACTION_REQUIRES_CONFIRMATION,
      };
    }
    const verdict = this.permits(source, tool.name, tool.annotations, access);
    if (verdict.denied) return { result: toolError('NOT_PERMITTED', `Not permitted (${verdict.denied}).`) };

    try {
      const out = await this.adapters.forProvider(source.provider).callTool(source.conn, tool.name, input ?? {});
      if (source.kind === 'builtin') await this.touch(source.docId);
      if (verdict.cls.sensitive) {
        await this.audit.record({
          actorId: userId,
          action: 'sensitive_skill.run',
          targetType: 'tool',
          targetId: name,
          meta: { provider, tool: tool.name, channel },
        });
      }
      return { result: out };
    } catch (err) {
      return { result: this.renderError(source.provider, err) };
    }
  }

  private async resolveBuiltin(userId: string, provider: string): Promise<ToolSource | string> {
    // Same visibility and selection as listing: own connection, else the newest workspace one.
    const conns = await this.connModel
      .find({ $or: [{ userId }, { scope: 'workspace' }], provider, status: 'active' })
      .lean();
    const [conn] = pickConnections(conns as any[], userId);
    if (!conn) return toolError('NO_CONNECTION', `No active ${provider} connection.`);
    const usable = await this.policyService.usableProviders([provider]);
    if (!usable.has(provider)) {
      return toolError('NOT_PERMITTED', `Not permitted: the ${provider} connector is disabled.`);
    }
    return this.builtinSource(conn);
  }

  private async resolveCustom(userId: string, provider: string, access: Access): Promise<ToolSource | string> {
    if (!access.member.perms.has(Capability.ADD_CUSTOM_MCP)) {
      return toolError('NOT_PERMITTED', 'Not permitted: custom MCP servers require the ADD_CUSTOM_MCP capability.');
    }
    const id = customServerIdOf(provider);
    if (!id || !isValidObjectId(id)) return toolError('NO_CONNECTION', 'Custom MCP server not found.');
    const srv = await this.customModel.findOne({ _id: id, userId }).lean();
    if (!srv) return toolError('NO_CONNECTION', 'Custom MCP server not found.');
    return this.customSource(srv);
  }

  /**
   * Map the exposed `<tool>` part back to the remote tool (and its
   * annotations). Accepts the original remote name too (in-flight requests
   * from before sanitisation). If the server cannot be listed right now, fall
   * back to the requested name with strict name-only classification.
   */
  private async resolveTool(source: ToolSource, requested: string): Promise<McpTool | null> {
    let list: McpTool[];
    try {
      list = await this.fetchTools(source);
    } catch (err) {
      if (err instanceof ToolExecutionError && err.code === 'CONNECTION_EXPIRED') throw err;
      this.logger.warn(`Tool lookup for ${source.provider} failed; using name-only classification`);
      return { name: requested, description: '', inputSchema: {} };
    }
    return (
      list.find((t) => exposedToolSegment(source.provider, t.name) === requested) ??
      list.find((t) => t.name === requested) ??
      null
    );
  }

  // ── Governance ────────────────────────────────────────────────────────────

  private async loadAccess(userId: string, channel: ToolChannel): Promise<Access | null> {
    const [member, policy] = await Promise.all([
      this.perms.resolveMember(userId),
      this.policyService.loadPolicy().catch((err: Error) => {
        this.logger.warn(`Connector policy unavailable (${err.message}); failing closed`);
        return null;
      }),
    ]);
    if (!member.active || !policy) return null;
    if (channel === 'bot' && !member.perms.has(Capability.USE_PERSONAL_ASSISTANT)) return null;
    const skills = channel === 'bot' ? await this.policyService.enabledSkillIds(userId) : null;
    return { member, policy, skills, channel };
  }

  /** Every write (sensitive or not) needs an explicit user confirmation. */
  private static needsConfirmation(cls: ToolClassification): boolean {
    return cls.sensitive || cls.group !== 'view';
  }

  private providerAllowed(provider: string, access: Access): boolean {
    if (!access.policy.workspaceAllows(provider) || !access.policy.aiAllows(provider)) return false;
    return access.skills === null || skillGateAllows(provider, access.skills);
  }

  private permits(
    source: ToolSource,
    remoteName: string,
    annotations: ToolAnnotationsLike | undefined,
    access: Access,
  ): Verdict {
    const cls = classifyTool(remoteName, annotations);
    if (!source.granted.includes(cls.group)) {
      return { cls, denied: `${cls.group} access not granted for ${source.provider}` };
    }
    if (cls.sensitive && !access.member.perms.has(Capability.RUN_SENSITIVE_SKILL)) {
      return { cls, denied: 'sensitive skill' };
    }
    return { cls };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private builtinSource(c: any): ToolSource {
    return {
      kind: 'builtin',
      provider: c.provider,
      conn: {
        provider: c.provider,
        userId: c.userId,
        mcpUrl: c.mcpUrl,
        encryptedTokens: c.encryptedTokens,
        encryptedClientCreds: c.encryptedClientCreds,
        tokenEndpoint: c.tokenEndpoint,
        _id: c._id,
      },
      granted: c.actionGroups ?? ALL_ACTION_GROUPS,
      cacheKey: `conn:${String(c._id)}:${fingerprint([c.mcpUrl, c.encryptedTokens?.data])}`,
      docId: c._id,
    };
  }

  private customSource(s: any): ToolSource {
    const provider = customProviderId(String(s._id));
    return {
      kind: 'custom',
      provider,
      conn: {
        provider,
        url: s.url,
        authType: s.authType,
        encryptedCredential: s.encryptedCredential,
        _id: s._id,
      },
      granted: ALL_ACTION_GROUPS,
      cacheKey: `custom:${String(s._id)}:${fingerprint([s.url, s.authType, s.encryptedCredential?.data])}`,
      docId: s._id,
    };
  }

  private async touch(docId: unknown): Promise<void> {
    try {
      await this.connModel.updateOne({ _id: docId }, { $set: { lastUsedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`lastUsedAt update failed: ${(err as Error).message}`);
    }
  }

  /** Clean, coded error for the model. Upstream bodies are only logged. */
  private renderError(provider: string, err: unknown): string {
    if (err instanceof ToolExecutionError) return toolError(err.code, err.message);
    if (err instanceof TimeoutError) {
      return toolError('UPSTREAM_TIMEOUT', `The ${provider} service did not respond in time.`);
    }
    if (err instanceof UnsafeUrlError) {
      return toolError('UPSTREAM_BLOCKED', `The ${provider} server address is not allowed.`);
    }
    const e = err as { name?: string; message?: string; code?: unknown } | null;
    if (e?.name === 'McpError') {
      if (e.code === -32001) return toolError('UPSTREAM_TIMEOUT', `The ${provider} service did not respond in time.`);
      // A protocol-level answer from the remote server (e.g. invalid params) — the tool's own output.
      const msg = clip(String(e.message ?? '').replace(/^MCP error -?\d+:\s*/, ''), 300);
      return toolError('TOOL_FAILED', msg || 'The tool failed.');
    }
    this.logger.error(`Tool call on ${provider} failed: ${e?.message ?? String(err)}`);
    const status = httpStatusOf(err);
    if (status) {
      const mapped = httpFailure(provider, status);
      return toolError(mapped.code, mapped.message);
    }
    return toolError('UPSTREAM_ERROR', `The ${provider} service could not be reached.`);
  }
}
