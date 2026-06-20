import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '@platform/database';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes connector-side privileged actions to the shared append-only audit
 * trail (`auditlogs`, same collection auth-service reads via GET /admin/audit).
 * Fire-and-forget safe: a failed audit write must never break the action that
 * triggered it.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
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
}
