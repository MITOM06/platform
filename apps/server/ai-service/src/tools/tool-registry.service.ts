import { Injectable, Logger } from '@nestjs/common';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { WebSearchTool } from './web-search.tool';
import { WebSearchService } from './web-search/web-search.service';
import { McpConnectorClient } from './mcp-connector.client';
import { ToolContext, ToolDefinition } from './tool.interface';
import { ToolResultCacheService } from './tool-result-cache.service';
import { isSensitiveTool } from '../ai/injection-guard';
import { SKILL_TOOL_REQUIREMENTS } from '../skills/skill-catalog';

/**
 * Filter dynamic MCP tools by the workspace AI connector allow-list (TASK-12).
 *
 * MCP tools are namespaced `mcp__<provider>__<tool>`; the connector-service
 * `/internal/tools` response carries NO separate catalog/connector-id field, so
 * the only mapping signal is the `<provider>` segment. For built-in connectors
 * the provider IS the catalog id (e.g. `gmail`, `notion`) — exact, safe match.
 *
 * Known limitation (documented, not guessed): custom MCP servers are namespaced
 * `custom:<id>` (NOT a catalog id), so they can never appear in `allowedConnectors`
 * (which holds catalog ids) and are therefore dropped whenever a non-null AI
 * allow-list is set. This is the safe/conservative behavior (deny-by-default for
 * the AI list) and is called out in the report for a follow-up if custom-MCP
 * allow-listing is required.
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
 * Gate action-skill MCP tools by enabled skills (Approach A). An MCP tool whose
 * provider is in `SKILL_TOOL_REQUIREMENTS` (calendar/gmail/notion) is kept ONLY
 * when its required skill is enabled; a provider NOT in the map passes through
 * unchanged. Non-MCP tools (`providerOf` → null) always pass. Applied AFTER the
 * RBAC allow-list filter so RBAC stays the highest-priority gate.
 */
export function filterBySkillGate(
  tools: ToolDefinition[],
  enabledSkillIds: readonly string[],
): ToolDefinition[] {
  const enabled = new Set(enabledSkillIds);
  // Every provider subject to skill gating (may be mapped by >1 skill, e.g.
  // gmail ← mailWriter + inboxTriage).
  const gatedProviders = new Set(
    Object.values(SKILL_TOOL_REQUIREMENTS).map((req) => req.provider),
  );
  // A provider is UNLOCKED if AT LEAST ONE of its mapping skills is enabled.
  const unlockedProviders = new Set(
    Object.entries(SKILL_TOOL_REQUIREMENTS)
      .filter(([skillId]) => enabled.has(skillId))
      .map(([, req]) => req.provider),
  );
  return tools.filter((t) => {
    const provider = providerOf(t.name);
    if (provider === null) return true; // non-MCP tool — never gated
    if (!gatedProviders.has(provider)) return true; // provider not gated by any skill
    return unlockedProviders.has(provider); // gated → keep only if unlocked
  });
}

/** Extract the `<provider>` segment from `mcp__<provider>__<tool>`; else null. */
export function providerOf(name: string): string | null {
  const PREFIX = 'mcp__';
  const SEP = '__';
  if (!name.startsWith(PREFIX)) return null;
  const rest = name.slice(PREFIX.length);
  const idx = rest.indexOf(SEP);
  return idx > 0 ? rest.slice(0, idx) : null;
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
    return [...staticDefs, ...skillFiltered];
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<string> {
    // Cache only read-only (non-sensitive) tools — never cache a send/create/
    // delete result. Short TTL; per-user so results are never shared across users.
    const cacheable = this.resultCache.isEnabled && !isSensitiveTool(toolName);
    if (cacheable) {
      const hit = await this.resultCache.get(ctx.userId, toolName, input);
      if (hit !== null) {
        this.logger.debug(`Tool cache hit [${toolName}]`);
        return hit;
      }
    }

    const result = await this.dispatch(toolName, input, ctx);

    // Don't cache failures (let the next call retry).
    if (cacheable && !result.startsWith('Tool error') && !result.startsWith('Tool not found')) {
      await this.resultCache.set(ctx.userId, toolName, input, result);
    }
    return result;
  }

  private async dispatch(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<string> {
    try {
      if (toolName.startsWith('mcp__')) {
        return await this.mcpConnector.callTool(ctx.userId, toolName, input);
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
