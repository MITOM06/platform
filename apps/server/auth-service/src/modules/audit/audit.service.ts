import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  User,
  UserDocument,
} from '@platform/database';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

export interface AuditListResult {
  items: Array<{
    id: string;
    actorId: string;
    actorName: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    meta: Record<string, unknown>;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * Records and reads the append-only audit trail. `record` is fire-and-forget
 * safe: an audit write must never break the privileged mutation that triggered
 * it, so failures are logged and swallowed. `list` batch-resolves actor display
 * names from the User collection to avoid storing denormalized names.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        meta: entry.meta ?? {},
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record audit ${entry.action}: ${(err as Error).message}`,
      );
    }
  }

  async list(page = 0, limit = 20): Promise<AuditListResult> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 0);
    const skip = safePage * safeLimit;

    const [rows, total] = await Promise.all([
      this.auditModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.auditModel.countDocuments().exec(),
    ]);

    const names = await this.resolveActorNames(rows.map((r) => r.actorId));

    return {
      items: rows.map((r) => ({
        id: r._id.toString(),
        actorId: r.actorId,
        actorName: r.actorName ?? names.get(r.actorId) ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId ?? null,
        meta: (r.meta as Record<string, unknown>) ?? {},
        createdAt: (r as unknown as { createdAt: Date }).createdAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  private async resolveActorNames(
    ids: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return new Map();
    const users = await this.userModel
      .find({ _id: { $in: unique } })
      .select('displayName')
      .lean()
      .exec();
    return new Map(
      users.map((u) => [u._id.toString(), u.displayName as string]),
    );
  }
}
