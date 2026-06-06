import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reminder, ReminderSchema } from './reminder.schema';
import { SearchMessagesTool } from './search-messages.tool';
import { GetUserInfoTool } from './get-user-info.tool';
import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { SummarizeConversationTool } from './summarize-conversation.tool';
import { CreateReminderTool } from './create-reminder.tool';
import { ToolRegistryService } from './tool-registry.service';
import { KbModule } from '../kb/kb.module';
import { MemoryModule } from '../memory/memory.module';

const reminderFeature = MongooseModule.forFeature([
  { name: Reminder.name, schema: ReminderSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [reminderFeature, KbModule, MemoryModule],
  providers: [
    SearchMessagesTool,
    GetUserInfoTool,
    SearchKnowledgeBaseTool,
    SummarizeConversationTool,
    CreateReminderTool,
    ToolRegistryService,
  ],
  exports: [ToolRegistryService],
})
export class ToolsModule {}
