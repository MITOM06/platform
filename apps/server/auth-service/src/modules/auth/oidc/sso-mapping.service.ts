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
   *  - the Owner role is never granted by a group mapping (only by an Owner's
   *    explicit action), and a user who is an Owner keeps that role (no SSO
   *    demotion); their departments still follow the IdP;
   *  - departments: set only when at least one group maps to an EXISTING
   *    department;
   *  - the bootstrap owner email is never touched at all (break-glass);
   *  - `changed` is true only when a stored value really differs (the caller
   *    then revokes sessions, so an unchanged repeat sign-in signs nobody out),
   *    and every change is audited as `member.sso_update` (actor `system`).
   */
  async apply(
    userId: string,
    email: string,
    groups: string[],
  ): Promise<{ changed: boolean }> {
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
    const ownerRoleId = roles
      .find((r: any) => r.name === OWNER_ROLE_NAME)
      ?._id.toString();
    // Owner is never granted through a mapping: groups mapped to it are ignored.
    const assignable = new Map<string, string>(
      roles
        .filter((r: any) => r.name !== OWNER_ROLE_NAME)
        .map((r: any) => [r.name, r._id.toString()]),
    );
    const mapping = resolveSsoMapping(groups ?? [], sso, assignable);

    // Filter to departments that still exist.
    const existing = await this.departmentModel.find().exec();
    const validIds = new Set(existing.map((d: any) => d._id.toString()));
    const mappedDepts = mapping.departmentIds.filter((d) => validIds.has(d));

    // ...nor removed by one: an Owner keeps the role whatever the groups say.
    const isOwner = !!ownerRoleId && current.roleId === ownerRoleId;
    const nextRoleId = isOwner
      ? current.roleId
      : (mapping.roleId ?? current.roleId);
    const nextDepts =
      mappedDepts.length > 0 ? mappedDepts : current.departmentIds;

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
