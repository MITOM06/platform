import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  Department,
  DepartmentDocument,
  Invitation,
  InvitationDocument,
  Role,
  RoleDocument,
  User,
  UserDocument,
} from '@platform/database';
import { isObjectIdString } from '../../common/ids';

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
    /** null for non-user actors (`system`) or deleted users — clients localize it. */
    actorName: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    /**
     * Human label of the target so clients never render raw ids: member →
     * displayName, role → name, department → name, invitation → email; for a
     * deleted department/role the name recorded in `meta` at write time; null
     * for anything else (workspace, connector-service rows, unknown ids).
     */
    targetName: string | null;
    meta: Record<string, unknown>;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}

type AuditRow = {
  actorId: string;
  actorName?: string;
  targetType: string;
  targetId?: string;
  meta?: unknown;
};

/**
 * Records and reads the append-only audit trail. `record` is fire-and-forget
 * safe: an audit write must never break the privileged mutation that triggered
 * it, so failures are logged and swallowed. `list` batch-resolves actor and
 * target display names (one query per collection) to avoid storing
 * denormalized names.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
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
    const safeLimit = Math.min(Math.max(toFinite(limit, 20), 1), 100);
    const safePage = Math.max(toFinite(page, 0), 0);
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

    const names = await this.resolveNames(rows as AuditRow[]);

    return {
      items: rows.map((r) => ({
        id: r._id.toString(),
        actorId: r.actorId,
        actorName: r.actorName ?? names.users.get(r.actorId) ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId ?? null,
        targetName: this.targetName(r as AuditRow, names),
        meta: (r.meta as Record<string, unknown>) ?? {},
        createdAt: (r as unknown as { createdAt: Date }).createdAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /**
   * Batch name lookup. Only well-formed ObjectIds reach `$in`: the bootstrap
   * Owner invitation is audited with actorId `'system'`, and casting that threw
   * a CastError — a 500 on every page containing it (on a fresh deployment,
   * the very first page).
   */
  private async resolveNames(rows: AuditRow[]): Promise<ResolvedNames> {
    const idsOf = (type: string) =>
      rows
        .filter((r) => r.targetType === type)
        .map((r) => r.targetId)
        .filter(isObjectIdString);
    const userIds = unique([
      ...rows.map((r) => r.actorId).filter(isObjectIdString),
      ...idsOf('member'),
    ]);
    const roleIds = unique(idsOf('role'));
    const deptIds = unique(idsOf('department'));
    const invitationIds = unique(idsOf('invitation'));

    const [users, roles, depts, invitations] = await Promise.all([
      userIds.length
        ? this.userModel
            .find({ _id: { $in: userIds } })
            .select('displayName')
            .lean()
            .exec()
        : [],
      roleIds.length
        ? this.roleModel
            .find({ _id: { $in: roleIds } })
            .select('name')
            .lean()
            .exec()
        : [],
      deptIds.length
        ? this.departmentModel
            .find({ _id: { $in: deptIds } })
            .select('name')
            .lean()
            .exec()
        : [],
      invitationIds.length
        ? this.invitationModel
            .find({ _id: { $in: invitationIds } })
            .select('email')
            .lean()
            .exec()
        : [],
    ]);
    const byId = <T extends { _id: unknown }>(docs: T[], field: keyof T) =>
      new Map(
        docs
          .filter((d) => typeof d[field] === 'string')
          .map((d) => [String(d._id), d[field] as unknown as string]),
      );
    return {
      users: byId(
        users as Array<{ _id: unknown; displayName?: string }>,
        'displayName',
      ),
      roles: byId(roles as Array<{ _id: unknown; name?: string }>, 'name'),
      departments: byId(
        depts as Array<{ _id: unknown; name?: string }>,
        'name',
      ),
      invitations: byId(
        invitations as Array<{ _id: unknown; email?: string }>,
        'email',
      ),
    };
  }

  private targetName(row: AuditRow, names: ResolvedNames): string | null {
    const id = row.targetId;
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const fromMeta = (key: string): string | null => {
      const value = meta[key];
      return typeof value === 'string' ? value : null;
    };
    const lookup = (map: Map<string, string>) => (id ? map.get(id) : undefined);
    switch (row.targetType) {
      case 'member':
        return lookup(names.users) ?? null;
      case 'role':
        return lookup(names.roles) ?? fromMeta('name');
      case 'department':
        return lookup(names.departments) ?? fromMeta('name');
      case 'invitation':
        return lookup(names.invitations) ?? fromMeta('email');
      default:
        return null;
    }
  }
}

interface ResolvedNames {
  users: Map<string, string>;
  roles: Map<string, string>;
  departments: Map<string, string>;
  invitations: Map<string, string>;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function toFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
