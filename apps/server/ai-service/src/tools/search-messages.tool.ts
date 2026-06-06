import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ToolContext, ToolDefinition } from './tool.interface';

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
    const query = input['query'] as string;
    const limit = Math.min((input['limit'] as number | undefined) ?? 5, 10);

    const messages = this.connection.collection('messages');
    const results = await messages
      .find({
        conversationId: ctx.conversationId,
        content: { $regex: query, $options: 'i' },
        type: { $in: ['text', 'ai'] },
        recalled: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (results.length === 0) {
      return `No messages found matching '${query}'`;
    }

    const users = this.connection.collection('users');
    const senderIds = [...new Set(results.map((m) => m['senderId'] as string))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userDocs = await users.find({ _id: { $in: senderIds } } as any).toArray();
    const nameMap = new Map(userDocs.map((u) => [String(u['_id']), u['displayName'] as string]));

    const formatted = results.map((m) => ({
      content: m['content'],
      senderDisplayName: nameMap.get(m['senderId'] as string) ?? m['senderId'],
      createdAt: m['createdAt'],
    }));

    return JSON.stringify(formatted);
  }
}
