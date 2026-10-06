import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Workspace, Role, Department } from '@platform/database';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { sameIdSet } from '../../../common/ids';
import { OWNER_ROLE_NAME } from '../../../common/role-grant';
import { SYSTEM_INVITER } from '../../invitations/invitation.shared';
import { resolveSsoMapping } from './sso-mapping';

@Injectable()
export class SsoMappingService {
  private readonly logger = new Logger(SsoMappingService.name);

  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<any>,
    @InjectModel(Role.name) private readonly roleModel: Model<any>,
    @InjectModel(Department.name) private readonly departmentModel: Model<any>,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async getGate(): Promise<{ enabled: boolean; allowedDomains: string[] }> {
    const ws = await this.workspaceModel.findOne().exec();
    return {
      enabled: ws?.sso?.enabled === true,
      allowedDomains: ws?.sso?.allowedDomains ?? [],
    };
  }

  /**
   * Apply the workspace's IdP-group mapping to a user signing in via SSO.
   *
   *  - role: set only when a group mapping matched or `defaultRole` is
   *    configured (and resolves) — with empty maps every SSO login used to
   *    reset the role to null (= Member) and revoke all sessions;
   *  - departments: set only when at least one group maps to an EXISTING
   *    department;
   *  - the last active Owner is never demoted by a mapping;
   *  - `changed` is true only when a stored value really differs, and every
   *    change is audited as `member.sso_update` (actor `system`).
   */
  async apply(
    userId: string,
    email: string,
    groups: string[],
  ): Promise<{ changed: boolean }> {
    // Break-glass: never demote the bootstrap owner via group mapping.
    const ownerEmail = this.config.get<string>('BOOTSTRAP_OWNER_EMAIL');
    if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
      return { changed: false };
    }

    const ws = await this.workspaceModel.findOne().exec();
    const sso = ws?.sso;
    if (!sso) return { changed: false };

    const current = await this.usersService.getMembership(userId);
    if (!current) return { changed: false };

    const roles = await this.roleModel.find().exec();
    const roleNameToId = new Map<string, string>(
      roles.map((r: any) => [r.name, r._id.toString()]),
    );
    const mapping = resolveSsoMapping(groups ?? [], sso, roleNameToId);

    // Filter to departments that still exist.
    const existing = await this.departmentModel.find().exec();
    const validIds = new Set(existing.map((d: any) => d._id.toString()));
    const mappedDepts = mapping.departmentIds.filter((d) => validIds.has(d));

    let nextRoleId = mapping.roleId ?? current.roleId;
    const nextDepts =
      mappedDepts.length > 0 ? mappedDepts : current.departmentIds;

    const ownerRoleId = roleNameToId.get(OWNER_ROLE_NAME);
    if (
      ownerRoleId &&
      current.roleId === ownerRoleId &&
      nextRoleId !== ownerRoleId &&
      (await this.usersService.countActiveWithRole(ownerRoleId, userId)) === 0
    ) {
      this.logger.warn(
        `SSO mapping would demote the last active Owner (user=${userId}); role kept`,
      );
      nextRoleId = current.roleId;
    }

    const roleChanged = nextRoleId !== current.roleId;
    const deptsChanged = !sameIdSet(nextDepts, current.departmentIds);
    if (!roleChanged && !deptsChanged) return { changed: false };

    await this.usersService.setRoleAndDepartments(
      userId,
      nextRoleId,
      nextDepts,
    );
    await this.audit.record({
      actorId: SYSTEM_INVITER,
      action: 'member.sso_update',
      targetType: 'member',
      targetId: userId,
      meta: {
        source: 'sso',
        changes: {
          ...(roleChanged ? { roleId: nextRoleId } : {}),
          ...(deptsChanged ? { departmentIds: nextDepts } : {}),
        },
        fromRoleId: current.roleId,
        fromDepartmentIds: current.departmentIds,
      },
    });
    return { changed: true };
  }
}
