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
    // Only offer web search when enabled in config AND a provider is configured
    // (graceful degradation — otherwise the tool is simply not registered).
    if (this.webSearchService.isAvailable()) {
      staticDefs.push(WebSearchTool.definition);
    }
    const dynamicDefs = await this.mcpConnector.getTools(ctx.userId);
    return [...staticDefs, ...dynamicDefs];
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
