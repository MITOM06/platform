import { Injectable } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { ToolContext, ToolDefinition } from './tool.interface';

@Injectable()
export class SummarizeConversationTool {
  static readonly definition: ToolDefinition = {
    name: 'summarize_conversation',
    description:
      'Get a summary of the conversation history and key facts remembered about the user.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  constructor(private readonly memoryService: MemoryService) {}

  async execute(_input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    // The REQUESTER's memory only: in a group every member has their own doc,
    // and another member's summary/facts must never reach this reply.
    const memory = await this.memoryService.getMemory(ctx.conversationId, ctx.userId);
    if (!memory) return 'No conversation summary available yet';

    let result = `Summary: ${memory.summary}`;
    if (memory.keyFacts && memory.keyFacts.length > 0) {
      result += `\n\nKey facts:\n${memory.keyFacts.map((f) => `- ${f}`).join('\n')}`;
    }
    return result;
  }
}
