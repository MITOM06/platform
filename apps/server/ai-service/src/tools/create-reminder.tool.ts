import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reminder, ReminderDocument } from './reminder.schema';
import { ToolContext, ToolDefinition } from './tool.interface';

@Injectable()
export class CreateReminderTool {
  static readonly definition: ToolDefinition = {
    name: 'create_reminder',
    description: 'Create a reminder for the user at a specific date and time.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind the user about' },
        remindAt: {
          type: 'string',
          description:
            'Absolute ISO 8601 datetime WITH offset, e.g. 2026-09-30T20:00:00+07:00, computed from the current date/time given in the system prompt',
        },
      },
      required: ['text', 'remindAt'],
    },
  };

  constructor(
    @InjectModel(Reminder.name) private readonly reminderModel: Model<ReminderDocument>,
  ) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const text = input['text'] as string;
    const remindAtStr = input['remindAt'] as string;

    const remindAt = new Date(remindAtStr);
    if (isNaN(remindAt.getTime())) {
      return `Tool error: Invalid date format '${remindAtStr}'. Use ISO 8601 format.`;
    }
    if (remindAt <= new Date()) {
      // Tell the model the real "now" so it can correct itself on retry.
      return `Tool error: Reminder time must be in the future (now is ${new Date().toISOString()}).`;
    }

    await this.reminderModel.create({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      text,
      remindAt,
    });

    const formatted = remindAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return `Reminder set: '${text}' at ${formatted}`;
  }
}
