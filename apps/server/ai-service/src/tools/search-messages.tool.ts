import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ToolContext, ToolDefinition } from './tool.interface';
import { resolveDisplayNames, UNKNOWN_MEMBER_LABEL } from '../common/user-names';

@Injectable()
export class SearchMessagesTool {
  static readonly definition: ToolDefinition = {
    name: 'search_messages',
    description:
      'Search for messages in the current conversation by keyword. Use when the user asks to find, recall, or look up something said earlier.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for' },
        limit: { type: 'number', description: 'Max results to return (default 5, max 10)' },
      },
      required: ['query'],
    },
  };

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const query = String(input['query'] ?? '');
    const limit = Math.min((input['limit'] as number | undefined) ?? 5, 10);
    // Literal match: a model-written query like "C++" or "(urgent" is not a regex
    // (it threw, and a crafted pattern could backtrack catastrophically).
    const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const messages = this.connection.collection('messages');
    const results = await messages
      .find({
        conversationId: ctx.conversationId,
        content: { $regex: literal, $options: 'i' },
        type: { $in: ['text', 'ai'] },
        recalled: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (results.length === 0) {
      return `No messages found matching '${query}'`;
    }

    const senderIds = [...new Set(results.map((m) => String(m['senderId'] ?? '')))];
    const nameMap = await resolveDisplayNames(this.connection, senderIds);

    // Never hand the model a raw user id — it would repeat it in the chat.
    const formatted = results.map((m) => ({
      content: m['content'],
      senderDisplayName: nameMap.get(String(m['senderId'] ?? '')) ?? UNKNOWN_MEMBER_LABEL,
      createdAt: m['createdAt'],
    }));

    return JSON.stringify(formatted);
  }
}
