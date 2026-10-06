import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotSession, BotSessionDocument } from './bot-session.schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_DAYS = 90;

export interface IssuedBotSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class BotSessionService {
  private readonly logger = new Logger(BotSessionService.name);
  private readonly ttlMs: number;

  constructor(
    @InjectModel(BotSession.name)
    private readonly model: Model<BotSessionDocument>,
    config: ConfigService,
  ) {
    const days = config.get<number>('botSessionTtlDays');
    this.ttlMs = (typeof days === 'number' && days > 0 ? days : DEFAULT_TTL_DAYS) * DAY_MS;
  }

  /**
   * Issues (or replaces) a bot session for the given (userId, botUserId) pair.
   * Returns the plaintext 32-byte token as a 64-char hex string — shown once,
   * never stored — and its absolute expiry. Previous tokens for the pair stop
   * working immediately.
   */
  async issue(userId: string, botUserId: string): Promise<IssuedBotSession> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.model.findOneAndUpdate(
      { userId, botUserId },
      { $set: { tokenHash, revokedAt: null, lastUsedAt: null, expiresAt } },
      { upsert: true, new: true },
    );
    this.logger.log(`Issued bot session for userId=${userId} botUserId=${botUserId}`);
    return { token, expiresAt };
  }

  /**
   * Validates a plaintext token. Returns the resolved identity, or null when
   * the token is unknown, revoked or expired. Updates lastUsedAt on success.
   */
  async validate(token: string): Promise<{ userId: string; botUserId: string } | null> {
    if (typeof token !== 'string' || !token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.model.findOne({ tokenHash, revokedAt: null }).lean();
    if (!session) return null;
    if (this.expiryOf(session) <= Date.now()) return null;
    // Fire-and-forget lastUsedAt update — don't block the request
    this.model
      .updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {
        /* non-critical */
      });
    return { userId: session.userId, botUserId: session.botUserId };
  }

  /** Expiry epoch-ms; legacy sessions without `expiresAt` use createdAt + TTL (0 = expired). */
  expiryOf(session: { expiresAt?: Date | string | null; createdAt?: Date | string }): number {
    if (session.expiresAt) return new Date(session.expiresAt).getTime();
    const created = session.createdAt ? new Date(session.createdAt).getTime() : NaN;
    return Number.isFinite(created) ? created + this.ttlMs : 0;
  }

  /** Soft-revokes the active session for this (userId, botUserId) pair. */
  async revoke(userId: string, botUserId: string): Promise<void> {
    await this.model.updateOne(
      { userId, botUserId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Lists all non-revoked sessions for a user (for admin display). */
  async findForUser(userId: string): Promise<BotSession[]> {
    return this.model.find({ userId, revokedAt: null }).lean();
  }
}
