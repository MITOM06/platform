import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Invitation,
  InvitationDocument,
  REMOVED_PRESET_ROLE_NAMES,
  Role,
  RoleDocument,
  User,
  UserDocument,
  Workspace,
  WorkspaceDocument,
} from '@platform/database';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';

const MEMBER_ROLE_NAME = 'Member';
/** Audit actor of boot-time changes (no human did them). */
const SYSTEM_ACTOR = 'system';

/** What one removed preset role took with it. */
export interface PresetRoleRemoval {
  name: string;
  usersMoved: number;
  invitationsMoved: number;
}

/**
 * Removes preset roles that PON no longer ships (`REMOVED_PRESET_ROLE_NAMES`,
 * i.e. the former "Manager") from an existing deployment. Runs at every boot
 * and is idempotent: once the role document is gone it does nothing.
 *
 * For a role named e.g. "Manager" WITH `isPreset: true`:
 *   1. every user holding it moves to the preset Member role, and their
 *      sessions are revoked (reason `role_changed`) so the new claims apply;
 *   2. pending invitations for it now grant Member;
 *   3. SSO mapping entries naming it (groupRoleMap values, defaultRole) now
 *      name Member;
 *   4. the role document is deleted; logged and audited `role.preset_removed`.
 * A custom role with the same name (`isPreset: false`) is left alone.
 */
@Injectable()
export class PresetRoleMigrationService {
  private readonly logger = new Logger(PresetRoleMigrationService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    private readonly session: SessionService,
    private readonly audit: AuditService,
  ) {}

  /** Call after the current presets were ensured (Member must exist). */
  async removeRetiredPresets(): Promise<PresetRoleRemoval[]> {
    const removed: PresetRoleRemoval[] = [];
    for (const name of REMOVED_PRESET_ROLE_NAMES) {
      const result = await this.removePreset(name);
      if (result) removed.push(result);
    }
    return removed;
  }

  private async removePreset(name: string): Promise<PresetRoleRemoval | null> {
    const role = await this.roleModel.findOne({ name, isPreset: true }).exec();
    if (!role) return null;
    const member = await this.roleModel
      .findOne({ name: MEMBER_ROLE_NAME })
      .exec();
    if (!member) {
      this.logger.warn(
        `Preset role "${name}" not removed: the "${MEMBER_ROLE_NAME}" role is missing`,
      );
      return null;
    }
    const roleId = role._id;
    const memberId = member._id;

    const holders = await this.userModel
      .find({ roleId })
      .select('_id')
      .lean()
      .exec();
    if (holders.length > 0) {
      await this.userModel
        .updateMany({ roleId }, { $set: { roleId: memberId } })
        .exec();
      for (const u of holders) {
        await this.session.revokeAllSessions(String(u._id), 'role_changed');
      }
    }
    const invitations = await this.invitationModel
      .updateMany({ roleId, status: 'pending' }, { $set: { roleId: memberId } })
      .exec();
    await this.remapSsoRoleName(name);
    await this.roleModel.deleteOne({ _id: roleId }).exec();

    const result: PresetRoleRemoval = {
      name,
      usersMoved: holders.length,
      invitationsMoved: invitations.modifiedCount ?? 0,
    };
    this.logger.log(
      `Removed preset role "${name}": ${result.usersMoved} user(s) and ` +
        `${result.invitationsMoved} pending invitation(s) moved to ${MEMBER_ROLE_NAME}`,
    );
    await this.audit.record({
      actorId: SYSTEM_ACTOR,
      action: 'role.preset_removed',
      targetType: 'role',
      targetId: roleId.toString(),
      meta: { ...result, movedTo: MEMBER_ROLE_NAME },
    });
    return result;
  }

  /** SSO group mapping stores role NAMES: point the removed one at Member. */
  private async remapSsoRoleName(name: string): Promise<void> {
    const ws = await this.workspaceModel.findOne().lean().exec();
    const sso = ws?.sso;
    if (!ws || !sso) return;
    const set: Record<string, unknown> = {};
    const map = { ...(sso.groupRoleMap ?? {}) };
    const groups = Object.keys(map).filter((g) => map[g] === name);
    if (groups.length > 0) {
      for (const g of groups) map[g] = MEMBER_ROLE_NAME;
      // Whole map: group names may contain '.' (not usable in a dot path).
      set['sso.groupRoleMap'] = map;
    }
    if (sso.defaultRole === name) set['sso.defaultRole'] = MEMBER_ROLE_NAME;
    if (Object.keys(set).length === 0) return;
    await this.workspaceModel.updateOne({ _id: ws._id }, { $set: set }).exec();
  }
}
