import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reminder, ReminderDocument } from './reminder.schema';
import { ToolContext, ToolDefinition } from './tool.interface';
import { isoInZone, parseDateTimeInZone, safeTimeZone } from '../common/time-zone';

const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * `create_reminder` — persists a reminder chat-service delivers when due.
 *
 * Times are interpreted in the deployment zone (`AI_TIMEZONE`): a `remindAt`
 * without an offset is wall-clock time there (it used to be read as UTC on the
 * UTC container and fired 7 h late), and the confirmation is formatted there
 * (`toLocaleString()` without a zone confirmed 20:00+07:00 as "1:00 PM").
 */
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

  private readonly timeZone: string;

  constructor(
    @InjectModel(Reminder.name) private readonly reminderModel: Model<ReminderDocument>,
    configService?: ConfigService,
  ) {
    this.timeZone = safeTimeZone(
      configService?.get<string>('config.ai.timeZone') ?? DEFAULT_TIME_ZONE,
      DEFAULT_TIME_ZONE,
    );
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const text = input['text'] as string;
    const remindAtStr = String(input['remindAt'] ?? '');

    const remindAt = parseDateTimeInZone(remindAtStr, this.timeZone);
    if (!remindAt) {
      return `Tool error: Invalid date format '${remindAtStr}'. Use ISO 8601 format.`;
    }
    const now = new Date();
    if (remindAt <= now) {
      // Tell the model the real "now" (in the deployment zone) so it can correct itself.
      return `Tool error: Reminder time must be in the future (now is ${isoInZone(now, this.timeZone)}).`;
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
      timeZone: this.timeZone,
    });
    return (
      `Reminder set: '${text}' at ${formatted} (${this.timeZone}, ` +
      `${isoInZone(remindAt, this.timeZone)})`
    );
  }
}
