import { Injectable, Logger } from '@nestjs/common';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { ToolContext, ToolDefinition } from './tool.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly searchMessages: SearchMessagesTool,
    private readonly getUserInfo: GetUserInfoTool,
    private readonly searchKnowledgeBase: SearchKnowledgeBaseTool,
    private readonly summarizeConversation: SummarizeConversationTool,
    private readonly createReminder: CreateReminderTool,
  ) {}

  getDefinitions(): ToolDefinition[] {
    return [
      SearchMessagesTool.definition,
      GetUserInfoTool.definition,
      SearchKnowledgeBaseTool.definition,
      SummarizeConversationTool.definition,
      CreateReminderTool.definition,
    ];
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<string> {
    try {
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
        default:
          return `Tool not found: ${toolName}`;
      }
    } catch (err) {
      this.logger.error(`Tool error [${toolName}]`, err);
      return `Tool error: ${(err as Error).message}`;
    }
  }
}
