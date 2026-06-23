import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './conversation.schema';
import { ConversationAccessService } from './conversation-access.service';

const conversationFeature = MongooseModule.forFeature([
  { name: Conversation.name, schema: ConversationSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [conversationFeature],
  providers: [ConversationAccessService],
  exports: [ConversationAccessService],
})
export class ConversationModule {}
