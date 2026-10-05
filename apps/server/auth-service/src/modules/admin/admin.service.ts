import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import {
  Workspace,
  WorkspaceDocument,
  Department,
  DepartmentDocument,
  Role,
  RoleDocument,
  User,
  UserDocument,
  Redis,
  REDIS_CLIENT,
} from '@platform/database';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { UpdateMemberDto, UpdateMemberStatusDto } from './dto/member.dto';
import { AuthCode } from '../../common/auth-code.enum';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { UpdateWorkspaceDto } from './dto/workspace.dto';

/**
 * Admin domain operations for the enterprise foundation: departments, members,
 * roles and the singleton workspace. All mutations are authorized at the
 * controller via @RequirePermission; this service enforces invariants (Owner
 * role immutable, revoke sessions on membership change).
 */
/** Redis channel ai-service subscribes to so it drops its cached AI settings. */
export const AI_SETTINGS_INVALIDATE_CHANNEL = 'ai:settings:invalidate';

const OWNER_ROLE_NAME = 'Owner';

/** Member list / status projection; `mfa.enabled` is mapped to `mfaEnabled`. */
const MEMBER_FIELDS = 'displayName email avatarUrl roleId departmentIds status mfa.enabled';

function toMemberView(doc: UserDocument) {
  const { mfa, ...rest } = doc.toObject();
  return { ...rest, mfaEnabled: mfa?.enabled === true };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly session: SessionService,
    private readonly audit: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ===================== DEPARTMENTS =====================
  listDepartments() {
    return this.departmentModel.find().exec();
  }

  async createDepartment(actorId: string, dto: CreateDepartmentDto) {
    const dept = await this.departmentModel.create(dto);
    await this.audit.record({
      actorId,
      action: 'department.create',
      targetType: 'department',
      targetId: dept._id.toString(),
      meta: { name: dept.name },
    });
    return dept;
  }

  async updateDepartment(
    actorId: string,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const dept = await this.departmentModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!dept) throw new NotFoundException({ code: AuthCode.DEPARTMENT_NOT_FOUND });
    await this.audit.record({
      actorId,
      action: 'department.update',
      targetType: 'department',
      targetId: id,
      meta: { changes: dto },
    });
    return dept;
  }

  async deleteDepartment(actorId: string, id: string) {
    const dept = await this.departmentModel.findByIdAndDelete(id).exec();
    if (!dept) throw new NotFoundException({ code: AuthCode.DEPARTMENT_NOT_FOUND });
    await this.audit.record({
      actorId,
      action: 'department.delete',
      targetType: 'department',
      targetId: id,
      meta: { name: dept.name },
    });
    return { success: true };
  }

  // ===================== MEMBERS =====================
  /** People only — system/bot accounts (e.g. "PON AI") are not members. */
  async listMembers() {
    const members = await this.userModel
      .find({ isBot: { $ne: true } })
      .select(MEMBER_FIELDS)
      .exec();
    return members.map(toMemberView);
  }

  /**
   * Assign a member's role and/or departments, then revoke all of their
   * sessions so stale permissions can't outlive a single access-token lifetime.
   * A role change (roleId present AND different) is guarded by
   * assertRoleChangeAllowed; an unchanged roleId is ignored.
   */
  async updateMember(
    actorId: string,
    actorRole: string | undefined,
    id: string,
    dto: UpdateMemberDto,
  ) {
    const member = isValidObjectId(id)
      ? await this.userModel.findById(id).exec()
      : null;
    // A bot account is not a member: no role, department or status changes.
    if (!member || member.isBot) {
      throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });
    }

    const set: Record<string, unknown> = {};
    const currentRoleId = member.roleId?.toString();
    const roleChanged = dto.roleId !== undefined && dto.roleId !== currentRoleId;
    if (roleChanged) {
      await this.assertRoleChangeAllowed(actorId, actorRole, id, currentRoleId, dto.roleId!);
      set.roleId = dto.roleId;
    }
    if (dto.departmentIds !== undefined) set.departmentIds = dto.departmentIds;
    if (Object.keys(set).length === 0) return member;

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });

    await this.session.revokeAllSessions(id, roleChanged ? 'role_changed' : 'other');
    await this.audit.record({
      actorId,
      action: 'member.update',
      targetType: 'member',
      targetId: id,
      meta: roleChanged ? { changes: set, fromRoleId: currentRoleId ?? null } : { changes: set },
    });
    return updated;
  }

  /**
   * Owner-role guard for PATCH /admin/members/:id (contract A):
   *  - own role                      → 400 CANNOT_CHANGE_OWN_ROLE
   *  - unknown target role           → 404 ROLE_NOT_FOUND
   *  - grant Owner / touch an Owner  → actor must be Owner, else 403 OWNER_ROLE_ASSIGN_FORBIDDEN
   *  - demote the last ACTIVE Owner  → 400 LAST_OWNER_CANNOT_BE_DEMOTED
   */
  private async assertRoleChangeAllowed(
    actorId: string,
    actorRole: string | undefined,
    targetId: string,
    currentRoleId: string | undefined,
    newRoleId: string,
  ) {
    if (targetId === actorId) {
      throw new BadRequestException({ code: AuthCode.CANNOT_CHANGE_OWN_ROLE });
    }
    const newRole = await this.roleModel.findById(newRoleId).exec();
    if (!newRole) throw new NotFoundException({ code: AuthCode.ROLE_NOT_FOUND });

    const ownerRole =
      newRole.name === OWNER_ROLE_NAME
        ? newRole
        : await this.roleModel.findOne({ name: OWNER_ROLE_NAME }).exec();
    const ownerRoleId = ownerRole?._id.toString();
    const grantsOwner = newRole.name === OWNER_ROLE_NAME;
    const targetIsOwner = !!ownerRoleId && currentRoleId === ownerRoleId;
    if ((grantsOwner || targetIsOwner) && actorRole !== OWNER_ROLE_NAME) {
      throw new ForbiddenException({ code: AuthCode.OWNER_ROLE_ASSIGN_FORBIDDEN });
    }

    if (targetIsOwner && !grantsOwner) {
      const otherActiveOwners = await this.userModel
        .countDocuments({
          _id: { $ne: targetId },
          roleId: ownerRole!._id,
          status: 'active',
        })
        .exec();
      if (otherActiveOwners === 0) {
        throw new BadRequestException({
          code: AuthCode.LAST_OWNER_CANNOT_BE_DEMOTED,
        });
      }
    }
  }

  /**
   * Block / unblock a member. Blocking revokes every session (auth-service
   * rejects the next request; chat-service within one access-token lifetime).
   * Idempotent: same status → 200 with no audit and no revoke.
   */
  async setMemberStatus(
    actorId: string,
    actorRole: string | undefined,
    id: string,
    dto: UpdateMemberStatusDto,
  ) {
    const member = isValidObjectId(id)
      ? await this.userModel.findById(id).exec()
      : null;
    // A bot account is not a member: no role, department or status changes.
    if (!member || member.isBot) {
      throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });
    }
    if ((member.status ?? 'active') === dto.status) return this.memberView(id);

    if (dto.status === 'blocked') {
      if (id === actorId) {
        throw new BadRequestException({ code: AuthCode.CANNOT_BLOCK_SELF });
      }
      const ownerRole = await this.roleModel.findOne({ name: 'Owner' }).exec();
      const isOwner =
        !!ownerRole && member.roleId?.toString() === ownerRole._id.toString();
      if (isOwner) {
        if (actorRole !== 'Owner') {
          throw new ForbiddenException({ code: AuthCode.OWNER_BLOCK_FORBIDDEN });
        }
        const otherActiveOwners = await this.userModel
          .countDocuments({
            _id: { $ne: id },
            roleId: ownerRole._id,
            status: 'active',
          })
          .exec();
        if (otherActiveOwners === 0) {
          throw new ConflictException({
            code: AuthCode.LAST_OWNER_CANNOT_BE_BLOCKED,
          });
        }
      }
    }

    await this.userModel
      .updateOne({ _id: id }, { $set: { status: dto.status } })
      .exec();
    if (dto.status === 'blocked') await this.session.revokeAllSessions(id, 'blocked');
    await this.audit.record({
      actorId,
      action: dto.status === 'blocked' ? 'member.block' : 'member.unblock',
      targetType: 'member',
      targetId: id,
    });
    return this.memberView(id);
  }

  private async memberView(id: string) {
    const member = await this.userModel.findById(id).select(MEMBER_FIELDS).exec();
    return member ? toMemberView(member) : null;
  }

  // ===================== ROLES =====================
  listRoles() {
    return this.roleModel.find().exec();
  }

  async createRole(actorId: string, dto: CreateRoleDto) {
    const role = await this.roleModel.create({
      name: dto.name,
      isPreset: false,
      permissions: dto.permissions ?? {},
    });
    await this.audit.record({
      actorId,
      action: 'role.create',
      targetType: 'role',
      targetId: role._id.toString(),
      meta: { name: role.name },
    });
    return role;
  }

  /** Edit a role's name/permissions. The Owner role is immutable. */
  async updateRole(actorId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.roleModel.findById(id).exec();
    if (!role) throw new NotFoundException({ code: AuthCode.ROLE_NOT_FOUND });
    if (role.name === 'Owner') {
      throw new BadRequestException({ code: AuthCode.OWNER_ROLE_IMMUTABLE });
    }

    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.permissions !== undefined) set.permissions = dto.permissions;

    const updated = await this.roleModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    await this.audit.record({
      actorId,
      action: 'role.update',
      targetType: 'role',
      targetId: id,
      meta: { changes: set },
    });
    return updated;
  }

  // ===================== WORKSPACE =====================
  async getWorkspace() {
    return this.workspaceModel.findOne().exec();
  }

  /**
   * Upsert the singleton workspace (one doc per deployment).
   *
   * `aiSettings` (TASK-12) is DEEP-MERGED via dot-path `$set` so a partial patch
   * never wipes sibling fields — a naive `$set: { aiSettings: {...partial} }`
   * would replace the whole sub-doc. On a successful save that touched
   * `aiSettings`, an invalidation message is published on
   * `ai:settings:invalidate` so ai-service drops its cache (next AI request
   * reloads). A 60s TTL on the ai-service side is the safety net if the publish
   * is ever missed.
   */
  async updateWorkspace(actorId: string, dto: UpdateWorkspaceDto) {
    const { aiSettings, ...rest } = dto;

    // Build a flat $set: top-level fields as-is, aiSettings keys as dot-paths so
    // unspecified aiSettings fields are preserved (deep-merge semantics).
    const set: Record<string, unknown> = { ...rest };
    if (aiSettings !== undefined) {
      await this.validateAiSettings(aiSettings);
      for (const [key, value] of Object.entries(aiSettings)) {
        if (value === undefined) continue; // skip absent keys; null is meaningful
        set[`aiSettings.${key}`] = value;
      }
    }

    const ws = await this.workspaceModel
      .findOneAndUpdate({}, { $set: set }, { new: true, upsert: true })
      .exec();

    await this.audit.record({
      actorId,
      action: 'workspace.update',
      targetType: 'workspace',
      targetId: ws?._id?.toString(),
      meta: { changes: dto },
    });

    if (aiSettings !== undefined) {
      try {
        await this.redis.publish(
          AI_SETTINGS_INVALIDATE_CHANNEL,
          JSON.stringify({ reason: 'workspace.update' }),
        );
      } catch (err) {
        // Non-fatal: the ai-service TTL safety net still converges within 60s.
        this.logger.warn(
          `Failed to publish ${AI_SETTINGS_INVALIDATE_CHANNEL}: ${(err as Error).message}`,
        );
      }
    }

    return ws;
  }

  /**
   * Validate AI connector allow-list against the OUTER workspace boundary: the
   * AI list can only NARROW `connectorAllowList`, never widen it. `null` (inherit)
   * and `[]` (allow none) are always valid.
   */
  private async validateAiSettings(
    aiSettings: UpdateWorkspaceDto['aiSettings'],
  ): Promise<void> {
    const allowed = aiSettings?.allowedConnectors;
    if (!Array.isArray(allowed) || allowed.length === 0) return;

    const ws = await this.workspaceModel
      .findOne({}, { connectorAllowList: 1 })
      .lean()
      .exec();
    const outer = new Set(ws?.connectorAllowList ?? []);
    const offenders = allowed.filter((c) => !outer.has(c));
    if (offenders.length > 0) {
      throw new BadRequestException({
        code: 'AI_CONNECTORS_NOT_IN_ALLOW_LIST',
        message:
          `allowedConnectors must be a subset of connectorAllowList. ` +
          `Not allowed: ${offenders.join(', ')}`,
      });
    }
  }

  // ===================== AUDIT =====================
  listAudit(page: number, limit: number) {
    return this.audit.list(page, limit);
  }
}
