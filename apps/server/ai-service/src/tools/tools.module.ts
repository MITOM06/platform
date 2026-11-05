import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reminder, ReminderSchema } from './reminder.schema';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { GetDepartmentContextTool } from './get-department-context.tool';
import { AiContextModule } from '../ai-context/ai-context.module';
import { SearchDirectoryTool } from './search-directory.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { RememberFactTool } from './remember-fact.tool';
import { WebSearchTool } from './web-search.tool';
import { WebSearchService } from './web-search/web-search.service';
import { GenericSearchProvider } from './web-search/generic-search.provider';
import { AnthropicWebSearchProvider } from './web-search/anthropic-web-search.provider';
import { McpConnectorClient } from './mcp-connector.client';
import { ToolRegistryService } from './tool-registry.service';
import { ToolResultCacheService } from './tool-result-cache.service';
import { KbModule } from '../kb/kb.module';
import { MemoryModule } from '../memory/memory.module';
import { RedisModule } from '../redis/redis.module';

const reminderFeature = MongooseModule.forFeature([
  { name: Reminder.name, schema: ReminderSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [reminderFeature, KbModule, MemoryModule, RedisModule, AiContextModule],
  providers: [
    SearchMessagesTool,
    GetUserInfoTool,
    GetDepartmentContextTool,
    SearchDirectoryTool,
    SearchKnowledgeBaseTool,
    SummarizeConversationTool,
    CreateReminderTool,
    RememberFactTool,
    WebSearchTool,
    WebSearchService,
    GenericSearchProvider,
    AnthropicWebSearchProvider,
    McpConnectorClient,
    ToolResultCacheService,
    ToolRegistryService,
  ],
  // McpConnectorClient: a confirmed pending action (actions/) executes its
  // stored input through the same connector client the loop uses.
  exports: [ToolRegistryService, McpConnectorClient],
})
export class ToolsModule {}
