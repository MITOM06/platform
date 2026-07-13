import { Injectable } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { ToolContext, ToolDefinition } from './tool.interface';

/**
 * On-demand memory write. The periodic `FactExtractorService` only persists
 * facts every N turns, so a short conversation where the user explicitly asks
 * to be remembered ("nhớ giúp tôi tên là Khang") never reaches the extraction
 * threshold — nothing lands in the memory store and the AI Memory UI stays
 * empty even though the model replied "sure, I'll remember".
 *
 * This tool lets the model persist those facts immediately via the SAME
 * `MemoryService.addFacts` path (embed → dedup → rebuild canonical Mongo list),
 * so they show up in `/api/ai/memories` right away. It returns the actual number
 * of facts stored so the model can be honest about whether it worked.
 */
@Injectable()
export class RememberFactTool {
  static readonly definition: ToolDefinition = {
    name: 'remember_fact',
    description:
      'Persist durable facts the user asks you to remember about them (their name, ' +
      'role, preferences, ongoing projects, important context) so you can recall them ' +
      'in any conversation with this user later. Call this whenever the user asks you to remember something ' +
      '("remember that…", "nhớ giúp tôi…", "ghi nhớ…") or states a lasting personal ' +
      'detail worth keeping. Only store what the user actually stated — never invent ' +
      'facts. Do NOT tell the user you have remembered something unless this tool ' +
      'returned success.',
    input_schema: {
      type: 'object',
      properties: {
        facts: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Short, self-contained facts about the user to remember, one per array entry ' +
            '(e.g. ["Name is Khang", "Works as a developer", "Building the PON platform"]).',
        },
      },
      required: ['facts'],
    },
  };

  constructor(private readonly memoryService: MemoryService) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const raw = input['facts'];
    const facts = (Array.isArray(raw) ? raw : [])
      .filter((f): f is string => typeof f === 'string')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    if (facts.length === 0) {
      return 'Tool error: No facts provided to remember.';
    }

    // Preserve the existing conversation summary + turn count so writing a fact
    // never wipes the summary or resets the message-count badge shown in the UI.
    const existing = await this.memoryService.getMemory(ctx.conversationId);
    const stored = await this.memoryService.addFacts(
      ctx.conversationId,
      ctx.userId,
      facts,
      existing?.summary ?? '',
      existing?.messageCount ?? 0,
      'user-requested',
    );

    if (stored === 0) {
      return 'Tool error: Could not store the fact(s) right now (memory backend unavailable). Do not claim you remembered it.';
    }
    return `Remembered ${stored} fact(s): ${facts.join('; ')}`;
  }
}
