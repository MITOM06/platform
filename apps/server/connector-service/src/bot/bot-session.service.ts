import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotSession, BotSessionDocument } from './bot-session.schema';

@Injectable()
export class BotSessionService {
  private readonly logger = new Logger(BotSessionService.name);

  constructor(
    @InjectModel(BotSession.name)
    private readonly model: Model<BotSessionDocument>,
  ) {}

  /**
   * Issues (or replaces) a bot session for the given (userId, botUserId) pair.
   * Returns the plaintext 32-byte token as a 64-char hex string — shown once,
   * never stored. Previous sessions for the same pair are superseded.
   */
  async issue(userId: string, botUserId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.model.findOneAndUpdate(
      { userId, botUserId },
      { $set: { tokenHash, revokedAt: null, lastUsedAt: null } },
      { upsert: true, new: true },
    );
    this.logger.log(`Issued bot session for userId=${userId} botUserId=${botUserId}`);
    return token;
  }

  /**
   * Validates a plaintext token. Returns the resolved identity or null when
   * the token is unknown or revoked. Updates lastUsedAt on success.
   */
  async validate(token: string): Promise<{ userId: string; botUserId: string } | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.model
      .findOne({ tokenHash, revokedAt: null })
      .lean();
    if (!session) return null;
    // Fire-and-forget lastUsedAt update — don't block the request
    this.model
      .updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {
        /* non-critical */
      });
    return { userId: session.userId, botUserId: session.botUserId };
  }

  /** Soft-revokes the active session for this (userId, botUserId) pair. */
  async revoke(userId: string, botUserId: string): Promise<void> {
    await this.model.updateOne(
      { userId, botUserId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Lists all active sessions for a user (for admin display). */
  async findForUser(userId: string): Promise<BotSession[]> {
    return this.model.find({ userId, revokedAt: null }).lean();
  }
}
