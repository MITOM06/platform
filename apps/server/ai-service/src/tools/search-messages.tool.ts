import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { toObjectIds } from '../common/object-id';
import { ToolContext, ToolDefinition } from './tool.interface';

function senderLabel(senderId: string, names: Map<string, string>): string {
  const name = names.get(senderId);
  if (name) return name;
  if (senderId?.startsWith('extbot:')) return 'Personal assistant bot';
  return 'Unknown user';
}

/** The query is model/user text — match it literally, never as a pattern. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
        content: { $regex: escapeRegex(query), $options: 'i' },
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
    const userDocs = await users
      // Real users are keyed by ObjectId; the seeded AI bot user by its string id.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find({ _id: { $in: [...toObjectIds(senderIds), ...senderIds] } } as any, {
        projection: { displayName: 1 },
      })
      .toArray();
    const nameMap = new Map(userDocs.map((u) => [String(u['_id']), u['displayName'] as string]));

    // Never hand the model a raw id: it repeats it verbatim to the user
    // (.claude/rules/no-raw-system-data-in-ui.md).
    const formatted = results.map((m) => ({
      content: m['content'],
      senderDisplayName: senderLabel(m['senderId'] as string, nameMap),
      createdAt: m['createdAt'],
    }));

    return JSON.stringify(formatted);
  }
}
