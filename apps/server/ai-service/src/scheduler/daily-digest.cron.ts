import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { SettingsService } from '../settings/settings.service';
import { DigestGeneratorService } from './digest-generator.service';
import { DigestLog, DigestLogDocument } from './digest-log.schema';
import { localHour, yesterdayWindow } from './digest-date.util';
import { safeTimeZone } from '../common/time-zone';

/** Mongo duplicate-key error code (unique-index idempotency guard). */
const DUP_KEY = 11000;
const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DEFAULT_BOT_USER_ID = 'ai-bot-000000000000000000000001';

/**
 * Daily-digest scheduler (TASK-11) — the FIRST @nestjs/schedule cron in
 * ai-service. Runs hourly; on the tick whose hour in the workspace zone
 * (`AI_TIMEZONE`) matches the configured `dailyDigestHour`, it posts a digest of
 * YESTERDAY's (same zone) human activity into each conversation that had some —
 * gated by the cached workspace-level `aiSettings.dailyDigestEnabled` opt-in.
 *
 * "Activity" is human text only: counting the bot's own `type:'ai'` messages
 * made yesterday's digest mark the conversation active again — a digest of the
 * digest every day, forever, even in a human DM nobody wrote in.
 *
 * Idempotency: a `DigestLog {conversationId, digestDate}` row is inserted BEFORE
 * generation; the unique index makes a duplicate insert (redeploy mid-run, two
 * instances) fail → that conversation is skipped. A row is rolled back if
 * generation throws OR there was no activity, so the next tick can retry.
 */
@Injectable()
export class DailyDigestCron {
  private readonly logger = new Logger(DailyDigestCron.name);
  private readonly timeZone: string;
  private readonly botUserId: string;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(DigestLog.name) private readonly digestLogModel: Model<DigestLogDocument>,
    private readonly settings: SettingsService,
    private readonly generator: DigestGeneratorService,
    configService?: ConfigService,
  ) {
    this.timeZone = safeTimeZone(
      configService?.get<string>('config.ai.timeZone') ?? DEFAULT_TIME_ZONE,
      DEFAULT_TIME_ZONE,
    );
    this.botUserId = configService?.get<string>('config.bot.userId') ?? DEFAULT_BOT_USER_ID;
  }

  /** Hourly tick. Top-level guarded so a failure never crashes the scheduler. */
  @Cron('0 * * * *')
  async run(now: Date = new Date()): Promise<void> {
    try {
      const settings = await this.settings.getSettings();
      if (settings.dailyDigestEnabled !== true) return;
      if (localHour(now, this.timeZone) !== settings.dailyDigestHour) return;

      const conversationIds = await this.activeConversations(now);
      if (conversationIds.length === 0) {
        this.logger.debug('Daily digest: no conversations active yesterday.');
        return;
      }
      this.logger.log(`Daily digest: processing ${conversationIds.length} conversation(s).`);

      for (const conversationId of conversationIds) {
        await this.processOne(conversationId, settings, now);
      }
    } catch (err) {
      this.logger.error(`Daily digest tick failed: ${(err as Error).message}`, err as Error);
    }
  }

  /**
   * Idempotent per-conversation handler: claim the slot via a unique-index
   * insert, generate+deliver, and roll the claim back if nothing was delivered
   * (no activity / generation failure) so a later run can retry.
   */
  private async processOne(
    conversationId: string,
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
    now: Date,
  ): Promise<void> {
    const { digestDate } = yesterdayWindow(now, this.timeZone);
    try {
      await this.digestLogModel.create({ conversationId, digestDate });
    } catch (err) {
      if ((err as { code?: number }).code === DUP_KEY) {
        // Already digested this conversation for this day — skip silently.
        return;
      }
      this.logger.error(
        `Failed to claim digest slot for ${conversationId}: ${(err as Error).message}`,
      );
      return;
    }

    try {
      const delivered = await this.generator.generateAndDeliver(conversationId, settings, now);
      if (!delivered) {
        // No activity / empty digest → release the slot so a retry can re-claim.
        await this.digestLogModel.deleteOne({ conversationId, digestDate }).exec();
      }
    } catch (err) {
      // Generation/delivery failed → roll back the claim for a future retry.
      await this.digestLogModel.deleteOne({ conversationId, digestDate }).exec();
      this.logger.error(
        `Digest generation failed for ${conversationId}: ${(err as Error).message}`,
      );
    }
  }

  /** Distinct conversationIds with non-recalled HUMAN text messages yesterday (workspace zone). */
  private async activeConversations(now: Date): Promise<string[]> {
    const { start, end } = yesterdayWindow(now, this.timeZone);
    const messages = this.connection.collection('messages');
    const ids = await messages.distinct('conversationId', {
      createdAt: { $gte: start, $lt: end },
      type: 'text',
      senderId: { $ne: this.botUserId },
      recalled: { $ne: true },
    });
    return (ids as unknown[]).map((id) => String(id)).filter(Boolean);
  }
}
