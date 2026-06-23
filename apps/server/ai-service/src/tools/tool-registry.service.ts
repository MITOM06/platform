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

/** Extract the `<provider>` segment from `mcp__<provider>__<tool>`; else null. */
function providerOf(name: string): string | null {
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
    return [...staticDefs, ...filterByAllowedConnectors(dynamicDefs, ctx.allowedConnectors)];
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
