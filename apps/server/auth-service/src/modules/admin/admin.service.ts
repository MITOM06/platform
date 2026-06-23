import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
import { UpdateMemberDto } from './dto/member.dto';
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
    if (!dept) throw new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND' });
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
    if (!dept) throw new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND' });
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
  listMembers() {
    return this.userModel
      .find()
      .select('displayName email avatarUrl roleId departmentIds status')
      .exec();
  }

  /**
   * Assign a member's role and/or departments, then revoke all of their
   * sessions so stale permissions can't outlive a single access-token lifetime.
   */
  async updateMember(actorId: string, id: string, dto: UpdateMemberDto) {
    const set: Record<string, unknown> = {};
    if (dto.roleId !== undefined) set.roleId = dto.roleId;
    if (dto.departmentIds !== undefined) set.departmentIds = dto.departmentIds;

    const member = await this.userModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    if (!member) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });

    await this.session.revokeAllSessions(id);
    await this.audit.record({
      actorId,
      action: 'member.update',
      targetType: 'member',
      targetId: id,
      meta: { changes: set },
    });
    return member;
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
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND' });
    if (role.name === 'Owner') {
      throw new BadRequestException({ code: 'OWNER_ROLE_IMMUTABLE' });
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
