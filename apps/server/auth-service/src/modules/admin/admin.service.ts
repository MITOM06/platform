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
import { UpdateMemberDto, UpdateMemberStatusDto } from './dto/member.dto';
import { AuthCode } from '../../common/auth-code.enum';
import { isObjectIdString, sameIdSet } from '../../common/ids';
import {
  assertCanGrant,
  isOwnerActor,
  OWNER_ROLE_NAME,
  RoleActor,
} from '../../common/role-grant';
import { UpdateWorkspaceDto, WorkspaceSsoDto } from './dto/workspace.dto';

/** Redis channel ai-service subscribes to so it drops its cached AI settings. */
export const AI_SETTINGS_INVALIDATE_CHANNEL = 'ai:settings:invalidate';

/**
 * Admin domain operations for the enterprise foundation: departments, members
 * and the singleton workspace (roles live in RolesService). All mutations are
 * authorized at the controller via @RequirePermission; this service enforces
 * invariants (Owner protections, no role grant beyond the actor's own
 * capabilities, revoke sessions only on a real membership change).
 */
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
    const dept = isObjectIdString(id)
      ? await this.departmentModel
          .findByIdAndUpdate(id, { $set: dto }, { new: true })
          .exec()
      : null;
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

  /**
   * Delete a department and every dangling reference to it: members'
   * `departmentIds` and SSO `groupDeptMap` entries (which would otherwise keep
   * re-assigning the deleted id on every SSO login).
   */
  async deleteDepartment(actorId: string, id: string) {
    const dept = isObjectIdString(id)
      ? await this.departmentModel.findByIdAndDelete(id).exec()
      : null;
    if (!dept) throw new NotFoundException({ code: AuthCode.DEPARTMENT_NOT_FOUND });
    const membersUpdated = await this.removeDepartmentReferences(id);
    await this.audit.record({
      actorId,
      action: 'department.delete',
      targetType: 'department',
      targetId: id,
      meta: { name: dept.name, membersUpdated },
    });
    return { success: true };
  }

  /** Never throws: the department is already gone; a failed cleanup is logged. */
  private async removeDepartmentReferences(id: string): Promise<number> {
    let membersUpdated = 0;
    try {
      const res = await this.userModel
        .updateMany({ departmentIds: id }, { $pull: { departmentIds: id } })
        .exec();
      membersUpdated = res?.modifiedCount ?? 0;

      const ws = await this.workspaceModel
        .findOne({}, { sso: 1 })
        .lean()
        .exec();
      const map: Record<string, unknown> = ws?.sso?.groupDeptMap ?? {};
      const kept = Object.fromEntries(
        Object.entries(map).filter(([, deptId]) => String(deptId) !== id),
      );
      if (ws && Object.keys(kept).length !== Object.keys(map).length) {
        // Whole-map $set: IdP group names may contain '.', which a dot-path
        // $unset would misread as nesting.
        await this.workspaceModel
          .updateOne({ _id: ws._id }, { $set: { 'sso.groupDeptMap': kept } })
          .exec();
      }
    } catch (err) {
      this.logger.warn(
        `Department ${id} deleted but reference cleanup failed: ${(err as Error).message}`,
      );
    }
    return membersUpdated;
  }

  // ===================== MEMBERS =====================
  listMembers() {
    return this.userModel
      .find()
      .select('displayName email avatarUrl roleId departmentIds status')
      .exec();
  }

  /**
   * Assign a member's role and/or departments. Only a REAL change is written —
   * the role differs, or the department SET differs (order/duplicates ignored)
   * — and only then are the member's sessions revoked, so stale permissions
   * can't outlive one access-token lifetime while a no-op Save (the web always
   * sends departmentIds) no longer logs the member out.
   *
   * A non-Owner may not change an Owner's departments (same rule as the role).
   */
  async updateMember(actor: RoleActor, id: string, dto: UpdateMemberDto) {
    const member = isObjectIdString(id)
      ? await this.userModel.findById(id).exec()
      : null;
    if (!member) throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });

    const set: Record<string, unknown> = {};
    const currentRoleId = member.roleId?.toString();
    const roleChanged = dto.roleId !== undefined && dto.roleId !== currentRoleId;
    const nextDepts =
      dto.departmentIds === undefined ? undefined : [...new Set(dto.departmentIds)];
    const deptsChanged =
      nextDepts !== undefined && !sameIdSet(nextDepts, member.departmentIds);

    if (roleChanged) {
      await this.assertRoleChangeAllowed(actor, id, currentRoleId, dto.roleId!);
      set.roleId = dto.roleId;
    }
    if (deptsChanged) {
      if (!roleChanged) await this.assertCanTouchMember(actor, currentRoleId);
      set.departmentIds = nextDepts;
    }
    if (Object.keys(set).length === 0) return member;

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });

    await this.session.revokeAllSessions(id, roleChanged ? 'role_changed' : 'other');
    await this.audit.record({
      actorId: actor.sub,
      action: 'member.update',
      targetType: 'member',
      targetId: id,
      meta: roleChanged ? { changes: set, fromRoleId: currentRoleId ?? null } : { changes: set },
    });
    return updated;
  }

  /** Owner members can only be modified by an Owner (departments-only path). */
  private async assertCanTouchMember(
    actor: RoleActor,
    targetRoleId: string | undefined,
  ) {
    if (isOwnerActor(actor) || !targetRoleId) return;
    const ownerRole = await this.roleModel.findOne({ name: OWNER_ROLE_NAME }).exec();
    if (ownerRole && ownerRole._id.toString() === targetRoleId) {
      throw new ForbiddenException({ code: AuthCode.OWNER_ROLE_ASSIGN_FORBIDDEN });
    }
  }

  /**
   * Role-change guard for PATCH /admin/members/:id (contract A):
   *  - own role                      → 400 CANNOT_CHANGE_OWN_ROLE
   *  - unknown target role           → 404 ROLE_NOT_FOUND
   *  - grant Owner / touch an Owner  → actor must be Owner, else 403 OWNER_ROLE_ASSIGN_FORBIDDEN
   *  - role grants a capability the actor lacks → 403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS
   *  - demote the last ACTIVE Owner  → 400 LAST_OWNER_CANNOT_BE_DEMOTED
   */
  private async assertRoleChangeAllowed(
    actor: RoleActor,
    targetId: string,
    currentRoleId: string | undefined,
    newRoleId: string,
  ) {
    if (targetId === actor.sub) {
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
    if ((grantsOwner || targetIsOwner) && !isOwnerActor(actor)) {
      throw new ForbiddenException({ code: AuthCode.OWNER_ROLE_ASSIGN_FORBIDDEN });
    }
    assertCanGrant(actor, newRole.permissions);

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
    const member = isObjectIdString(id)
      ? await this.userModel.findById(id).exec()
      : null;
    if (!member) throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });
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

  private memberView(id: string) {
    return this.userModel
      .findById(id)
      .select('displayName email avatarUrl roleId departmentIds status')
      .exec();
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
  async updateWorkspace(actor: RoleActor, dto: UpdateWorkspaceDto) {
    await this.assertSsoMappingAllowed(actor, dto.sso);
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
      actorId: actor.sub,
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
   * SSO group mappings hand roles out on every SSO login, so they follow the
   * same anti-escalation rule as assigning a role directly:
   *  - mapping a group (or `defaultRole`) to the Owner role → Owner only, else
   *    403 OWNER_SSO_MAPPING_FORBIDDEN;
   *  - any other mapped role must stay inside the actor's own capabilities,
   *    else 403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS.
   * `sso` is replaced as a whole by the PATCH, so the payload is the full
   * resulting mapping. Unknown role names are ignored (they never resolve).
   */
  private async assertSsoMappingAllowed(
    actor: RoleActor,
    sso: WorkspaceSsoDto | undefined,
  ): Promise<void> {
    if (!sso || isOwnerActor(actor)) return;
    const names = [
      ...Object.values(sso.groupRoleMap ?? {}),
      sso.defaultRole,
    ].filter((n): n is string => typeof n === 'string' && n.length > 0);
    if (names.length === 0) return;
    if (names.includes(OWNER_ROLE_NAME)) {
      throw new ForbiddenException({ code: AuthCode.OWNER_SSO_MAPPING_FORBIDDEN });
    }
    const roles = await this.roleModel
      .find({ name: { $in: [...new Set(names)] } })
      .lean()
      .exec();
    assertCanGrant(actor, ...roles.map((r) => r.permissions));
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
