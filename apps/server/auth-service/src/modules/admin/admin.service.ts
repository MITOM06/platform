import {
  BadRequestException,
  Injectable,
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
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly session: SessionService,
    private readonly audit: AuditService,
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

  /** Upsert the singleton workspace (one doc per deployment). */
  async updateWorkspace(actorId: string, dto: UpdateWorkspaceDto) {
    const ws = await this.workspaceModel
      .findOneAndUpdate({}, { $set: dto }, { new: true, upsert: true })
      .exec();
    await this.audit.record({
      actorId,
      action: 'workspace.update',
      targetType: 'workspace',
      targetId: ws?._id?.toString(),
      meta: { changes: dto },
    });
    return ws;
  }

  // ===================== AUDIT =====================
  listAudit(page: number, limit: number) {
    return this.audit.list(page, limit);
  }
}
