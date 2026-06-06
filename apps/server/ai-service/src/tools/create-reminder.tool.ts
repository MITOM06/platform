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
          description: 'ISO 8601 datetime string for when to send the reminder',
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
      return `Tool error: Reminder time must be in the future.`;
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
