import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Workspace, Role, Department } from '@platform/database';
import { UsersService } from '../../users/users.service';
import { resolveSsoMapping } from './sso-mapping';

const OWNER_ROLE_NAME = 'Owner';

/** Same members, any order. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

@Injectable()
export class SsoMappingService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<any>,
    @InjectModel(Role.name) private readonly roleModel: Model<any>,
    @InjectModel(Department.name) private readonly departmentModel: Model<any>,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async getGate(): Promise<{ enabled: boolean; allowedDomains: string[] }> {
    const ws = await this.workspaceModel.findOne().exec();
    return {
      enabled: ws?.sso?.enabled === true,
      allowedDomains: ws?.sso?.allowedDomains ?? [],
    };
  }

  /**
   * Applies the IdP groups to the user's role + departments at SSO sign-in.
   *  - The Owner role is never granted by a group mapping (only by an Owner's
   *    explicit action), and a user who is currently an Owner keeps that role
   *    (no SSO demotion); their departments still follow the IdP.
   *  - The bootstrap owner email is never touched at all (break-glass).
   *  - `changed` is true only when the stored roleId or department set really
   *    differs (the caller then revokes sessions), so a repeat sign-in with
   *    unchanged groups does not sign the user out elsewhere.
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
    const user = await this.usersService.findById(userId);
    if (!user) return { changed: false };

    const roles = await this.roleModel.find().exec();
    const ownerRoleId = roles
      .find((r: any) => r.name === OWNER_ROLE_NAME)
      ?._id.toString();
    // Owner is not assignable through a mapping: groups mapped to it are ignored.
    const assignable = new Map<string, string>(
      roles
        .filter((r: any) => r.name !== OWNER_ROLE_NAME)
        .map((r: any) => [r.name, r._id.toString()]),
    );
    const mapped = resolveSsoMapping(groups, sso, assignable);

    // Filter to departments that still exist.
    const existing = await this.departmentModel.find().exec();
    const validIds = new Set(existing.map((d: any) => d._id.toString()));
    const depts = mapped.departmentIds.filter((d) => validIds.has(d));

    const currentRoleId = user.roleId ? String(user.roleId) : null;
    const isOwner = !!ownerRoleId && currentRoleId === ownerRoleId;
    const roleId = isOwner ? currentRoleId : mapped.roleId;
    const currentDepts = (user.departmentIds ?? []).map((d: unknown) =>
      String(d),
    );
    if (roleId === currentRoleId && sameIds(depts, currentDepts)) {
      return { changed: false };
    }

    await this.usersService.setRoleAndDepartments(userId, roleId, depts);
    return { changed: true };
  }
}
