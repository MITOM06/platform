import { Injectable, Logger } from '@nestjs/common';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { RememberFactTool } from './remember-fact.tool';
import { WebSearchTool } from './web-search.tool';
import { WebSearchService } from './web-search/web-search.service';
import { McpConnectorClient } from './mcp-connector.client';
import { ToolContext, ToolDefinition } from './tool.interface';
import { ToolResultCacheService } from './tool-result-cache.service';
import { isSensitiveTool } from '../ai/injection-guard';
import { SKILL_TOOL_REQUIREMENTS } from '../skills/skill-catalog';
import { MCP_PREFIX, providerOf, toolOf } from './tool-names';

// Re-exported: these used to live here and are imported from this module.
export { providerOf, toolOf } from './tool-names';

/** Anthropic's tool-name rule. One violating name 400s the whole request. */
const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Read-only tools that must NOT go through the text result cache anyway:
 *  - `web_search` / `search_knowledge_base` register citable sources and print
 *    reply-relative `[Source N]` numbers — a cached text would replay stale
 *    numbering and lose the citation chips;
 *  - `summarize_conversation` reads memory that `remember_fact` may have just
 *    changed in the same reply (and is a single indexed read).
 * Sensitive (state-changing) tools are never cached either — see `isCacheableTool`.
 */
const NEVER_CACHED_TOOLS: ReadonlySet<string> = new Set([
  'web_search',
  'search_knowledge_base',
  'summarize_conversation',
]);

/** Whether a tool's result may be served from the short-TTL result cache. */
export function isCacheableTool(toolName: string): boolean {
  return !isSensitiveTool(toolName) && !NEVER_CACHED_TOOLS.has(toolName);
}

/**
 * Filter dynamic MCP tools by the workspace AI connector allow-list (TASK-12).
 *
 * MCP tools are namespaced `mcp__<provider>__<tool>`; the connector-service
 * `/internal/tools` response carries NO separate catalog/connector-id field, so
 * the only mapping signal is the `<provider>` segment. For built-in connectors
 * the provider IS the catalog id (e.g. `gmail`, `notion`) — exact, safe match.
 * Custom MCP servers are not catalog ids, so they never pass a non-null AI
 * allow-list (conservative: deny by default for the AI list).
 *
 * Semantics: `allowedConnectors == null`/undefined ⇒ no filtering (inherit the
 * workspace-wide list, already enforced upstream by connector-service). `[]` ⇒
 * AI may use NO MCP tools. `[...]` ⇒ keep only tools whose provider is in the set.
 */
export function filterByAllowedConnectors(
  tools: ToolDefinition[],
  allowedConnectors: string[] | null | undefined,
): ToolDefinition[] {
  if (allowedConnectors == null) return tools; // inherit — no AI-specific filter
  const allow = new Set(allowedConnectors);
  return tools.filter((t) => {
    const provider = providerOf(t.name);
    return provider !== null && allow.has(provider);
  });
}

/**
 * Gate action-skill MCP tools by enabled skills (Approach A), PER TOOL. A tool
 * of a provider that appears in `SKILL_TOOL_REQUIREMENTS` is kept only when an
 * enabled skill maps that provider AND (lists no tools, or lists this tool).
 * Providers no skill maps pass through; non-MCP tools always pass. Applied AFTER
 * the RBAC allow-list filter so RBAC stays the highest-priority gate.
 */
export function filterBySkillGate(
  tools: ToolDefinition[],
  enabledSkillIds: readonly string[],
): ToolDefinition[] {
  const enabled = new Set(enabledSkillIds);
  const requirements = Object.entries(SKILL_TOOL_REQUIREMENTS);
  const gatedProviders = new Set(requirements.map(([, req]) => req.provider));
  const unlocked = requirements.filter(([skillId]) => enabled.has(skillId)).map(([, req]) => req);
  return tools.filter((t) => {
    const provider = providerOf(t.name);
    if (provider === null) return true; // non-MCP tool — never gated
    if (!gatedProviders.has(provider)) return true; // provider not gated by any skill
    const bare = toolOf(t.name)?.toLowerCase() ?? '';
    return unlocked.some(
      (req) =>
        req.provider === provider &&
        (!req.tools || req.tools.some((name) => name.toLowerCase() === bare)),
    );
  });
}

/**
 * Defence in depth against connector bugs: Anthropic rejects the WHOLE request
 * (400 → "AI temporarily unavailable" on every message) when any tool name breaks
 * `^[a-zA-Z0-9_-]{1,64}$` (e.g. `mcp__custom:<id>__x`), two tools share a name, or
 * a schema is not an object schema. Offenders are dropped (logged) — first
 * definition of a duplicated name wins, so built-ins beat connector tools.
 */
export function sanitizeToolDefinitions(
  defs: ToolDefinition[],
  warn: (message: string) => void = () => undefined,
): ToolDefinition[] {
  const seen = new Set<string>();
  const out: ToolDefinition[] = [];
  for (const def of defs) {
    const name = typeof def?.name === 'string' ? def.name : '';
    if (!TOOL_NAME_RE.test(name)) {
      warn(`Dropping tool with an invalid name "${name.slice(0, 80)}"`);
      continue;
    }
    if (seen.has(name)) {
      warn(`Dropping duplicate tool "${name}"`);
      continue;
    }
    const schema = def.input_schema as unknown;
    if (
      !schema ||
      typeof schema !== 'object' ||
      Array.isArray(schema) ||
      (schema as { type?: unknown }).type !== 'object'
    ) {
      warn(`Dropping tool "${name}": input_schema is not an object schema`);
      continue;
    }
    seen.add(name);
    out.push(def);
  }
  return out;
}

export interface ExecuteOptions {
  /** The offered definition is flagged sensitive by connector-service. */
  sensitive?: boolean;
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly searchMessages: SearchMessagesTool,
    private readonly getUserInfo: GetUserInfoTool,
    private readonly searchKnowledgeBase: SearchKnowledgeBaseTool,
    private readonly summarizeConversation: SummarizeConversationTool,
    private readonly createReminder: CreateReminderTool,
    private readonly rememberFact: RememberFactTool,
    private readonly webSearch: WebSearchTool,
    private readonly webSearchService: WebSearchService,
    private readonly mcpConnector: McpConnectorClient,
    private readonly resultCache: ToolResultCacheService,
  ) {}

  async getDefinitions(ctx: ToolContext): Promise<ToolDefinition[]> {
    const staticDefs: ToolDefinition[] = [
      SearchMessagesTool.definition,
      GetUserInfoTool.definition,
      SearchKnowledgeBaseTool.definition,
      SummarizeConversationTool.definition,
      CreateReminderTool.definition,
      RememberFactTool.definition,
    ];
    // Offer web search when: the workspace toggle is not explicitly OFF
    // (TASK-12) AND a provider is configured (TASK-09 graceful-degradation gate).
    // `ctx.webSearchEnabled === false` ⇒ never register; undefined/true defers to
    // the provider gate (preserves env behavior).
    if (ctx.webSearchEnabled !== false && this.webSearchService.isAvailable()) {
      staticDefs.push(WebSearchTool.definition);
    }
    const dynamicDefs = await this.mcpConnector.getTools(ctx.userId);
    // RBAC allow-list first (highest priority), then the skill consent gate.
    const rbacFiltered = filterByAllowedConnectors(dynamicDefs, ctx.allowedConnectors);
    const skillFiltered = filterBySkillGate(rbacFiltered, ctx.enabledSkillIds ?? []);
    return sanitizeToolDefinitions([...staticDefs, ...skillFiltered], (m) =>
      this.logger.warn(`${m} (user ${ctx.userId})`),
    );
  }

  /**
   * Run one tool. `opts.sensitive` is the offered definition's connector flag:
   * a flagged tool is never cached and gets the connector write timeout even
   * when its name carries no write marker. (Tools that need a user
   * confirmation never reach this method — the loop stages them instead.)
   */
  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
    opts: ExecuteOptions = {},
  ): Promise<string> {
    // Cache only read-only tools whose output is plain text (see isCacheableTool),
    // keyed by user + conversation + department scope so a result never leaks
    // into another conversation. Never a send/create/delete result.
    const cacheable =
      this.resultCache.isEnabled && opts.sensitive !== true && isCacheableTool(toolName);
    const scope = {
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      departmentId: ctx.departmentId,
    };
    if (cacheable) {
      const hit = await this.resultCache.get(scope, toolName, input);
      if (hit !== null) {
        this.logger.debug(`Tool cache hit [${toolName}]`);
        return hit;
      }
    }

    const result = await this.dispatch(toolName, input, ctx, opts.sensitive === true);

    // Don't cache failures (let the next call retry).
    if (cacheable && !result.startsWith('Tool error') && !result.startsWith('Tool not found')) {
      await this.resultCache.set(scope, toolName, input, result);
    }
    return result;
  }

  private async dispatch(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
    write: boolean,
  ): Promise<string> {
    try {
      if (toolName.startsWith(MCP_PREFIX)) {
        return write
          ? await this.mcpConnector.callTool(ctx.userId, toolName, input, { write: true })
          : await this.mcpConnector.callTool(ctx.userId, toolName, input);
      }
      switch (toolName) {
        case 'search_messages':
          return await this.searchMessages.execute(input, ctx);
        case 'get_user_info':
          return await this.getUserInfo.execute(input, ctx);
        case 'search_knowledge_base':
          return await this.searchKnowledgeBase.execute(input, ctx);
        case 'summarize_conversation':
          return await this.summarizeConversation.execute(input, ctx);
        case 'create_reminder':
          return await this.createReminder.execute(input, ctx);
        case 'remember_fact':
          return await this.rememberFact.execute(input, ctx);
        case 'web_search':
          return await this.webSearch.execute(input, ctx);
        default:
          return `Tool not found: ${toolName}`;
      }
    } catch (err) {
      this.logger.error(`Tool error [${toolName}]`, err);
      return `Tool error: ${(err as Error).message}`;
    }
  }
}
