import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { SettingsService } from '../settings/settings.service';
import { DigestGeneratorService } from './digest-generator.service';
import { DigestLog, DigestLogDocument } from './digest-log.schema';
import { yesterdayWindow } from './digest-date.util';

/** Mongo duplicate-key error code (unique-index idempotency guard). */
const DUP_KEY = 11000;

/**
 * Daily-digest scheduler (TASK-11) — the FIRST @nestjs/schedule cron in
 * ai-service. Runs hourly; on the tick whose LOCAL hour matches the workspace's
 * configured `dailyDigestHour`, it posts a digest of YESTERDAY's activity into
 * each conversation that was active yesterday — gated by the cached
 * workspace-level `aiSettings.dailyDigestEnabled` opt-in (TASK-12 infra).
 *
 * Idempotency: a `DigestLog {conversationId, digestDate}` row is inserted BEFORE
 * generation; the unique index makes a duplicate insert (redeploy mid-run, two
 * instances) fail → that conversation is skipped. A row is rolled back if
 * generation throws OR there was no activity, so the next tick can retry.
 */
@Injectable()
export class DailyDigestCron {
  private readonly logger = new Logger(DailyDigestCron.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(DigestLog.name) private readonly digestLogModel: Model<DigestLogDocument>,
    private readonly settings: SettingsService,
    private readonly generator: DigestGeneratorService,
  ) {}

  /** Hourly tick. Top-level guarded so a failure never crashes the scheduler. */
  @Cron('0 * * * *')
  async run(now: Date = new Date()): Promise<void> {
    try {
      const settings = await this.settings.getSettings();
      if (settings.dailyDigestEnabled !== true) return;
      if (now.getHours() !== settings.dailyDigestHour) return;

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
    const { digestDate } = yesterdayWindow(now);
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

  /** Distinct conversationIds with non-recalled text/ai messages yesterday. */
  private async activeConversations(now: Date): Promise<string[]> {
    const { start, end } = yesterdayWindow(now);
    const messages = this.connection.collection('messages');
    const ids = await messages.distinct('conversationId', {
      createdAt: { $gte: start, $lt: end },
      type: { $in: ['text', 'ai'] },
      recalled: { $ne: true },
    });
    return (ids as unknown[]).map((id) => String(id)).filter(Boolean);
  }
}
