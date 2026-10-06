import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PermissionMatrix,
  Role,
  RoleDocument,
  User,
  UserDocument,
  enabledCapabilities,
} from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { isObjectIdString } from '../../common/ids';
import {
  assertCanGrant,
  isOwnerActor,
  isReservedRoleName,
  MEMBER_ROLE_NAME,
  OWNER_ROLE_NAME,
  RoleActor,
} from '../../common/role-grant';
import { isDuplicateKey } from '../invitations/invitation.shared';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/**
 * Role administration (`/admin/roles`). Every mutation enforces the anti-escalation rule from
 * common/role-grant: a non-Owner can only create or edit roles inside their own capability set,
 * and never the role they currently hold. The Owner role is immutable; preset roles keep their
 * name (bootstrap re-seeds presets by name, so a rename would spawn a duplicate on next boot).
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly audit: AuditService,
    private readonly session: SessionService,
  ) {}

  listRoles() {
    return this.roleModel.find().exec();
  }

  /**
   * Check order: ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS (403) → ROLE_NAME_TAKEN (409, also for a
   * reserved preset name).
   */
  async createRole(actor: RoleActor, dto: CreateRoleDto) {
    assertCanGrant(actor, dto.permissions);
    if (isReservedRoleName(dto.name)) {
      throw new ConflictException({ code: AuthCode.ROLE_NAME_TAKEN });
    }

    let role: RoleDocument;
    try {
      role = await this.roleModel.create({
        name: dto.name,
        isPreset: false,
        permissions: dto.permissions ?? {},
      });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new ConflictException({ code: AuthCode.ROLE_NAME_TAKEN });
      }
      throw e;
    }
    await this.audit.record({
      actorId: actor.sub,
      action: 'role.create',
      targetType: 'role',
      targetId: role._id.toString(),
      meta: { name: role.name },
    });
    return role;
  }

  /**
   * Edit a role's name/permissions.
   * Check order: ROLE_NOT_FOUND (404) → OWNER_ROLE_IMMUTABLE (400) → CANNOT_EDIT_OWN_ROLE (403)
   * → ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS (403; current AND resulting grants must be inside the
   * actor's perms) → PRESET_ROLE_RENAME_FORBIDDEN (400) → ROLE_NAME_TAKEN (409).
   *
   * When the enabled capability set or the name (the JWT `role` claim) really changes, every
   * holder's sessions are marked claims-stale: their next request with an older access token
   * gets 401 TOKEN_CLAIMS_STALE and the refresh carries the new claims (no sign-out).
   */
  async updateRole(actor: RoleActor, id: string, dto: UpdateRoleDto) {
    const role = isObjectIdString(id)
      ? await this.roleModel.findById(id).exec()
      : null;
    if (!role) throw new NotFoundException({ code: AuthCode.ROLE_NOT_FOUND });
    if (role.name === OWNER_ROLE_NAME) {
      throw new BadRequestException({ code: AuthCode.OWNER_ROLE_IMMUTABLE });
    }

    if (!isOwnerActor(actor)) {
      if (await this.actorHoldsRole(actor, role)) {
        throw new ForbiddenException({ code: AuthCode.CANNOT_EDIT_OWN_ROLE });
      }
      // Both: you may not reshape a role that is above you, nor lift one above you.
      assertCanGrant(actor, role.permissions, dto.permissions);
    }

    const renaming = dto.name !== undefined && dto.name !== role.name;
    if (renaming) {
      if (role.isPreset) {
        throw new BadRequestException({
          code: AuthCode.PRESET_ROLE_RENAME_FORBIDDEN,
        });
      }
      if (isReservedRoleName(dto.name!)) {
        throw new ConflictException({ code: AuthCode.ROLE_NAME_TAKEN });
      }
    }

    const set: Record<string, unknown> = {};
    if (renaming) set.name = dto.name;
    if (dto.permissions !== undefined) set.permissions = dto.permissions;
    if (Object.keys(set).length === 0) return role;

    let updated: RoleDocument | null;
    try {
      updated = await this.roleModel
        .findByIdAndUpdate(id, { $set: set }, { new: true })
        .exec();
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new ConflictException({ code: AuthCode.ROLE_NAME_TAKEN });
      }
      throw e;
    }
    if (!updated)
      throw new NotFoundException({ code: AuthCode.ROLE_NOT_FOUND });

    await this.audit.record({
      actorId: actor.sub,
      action: 'role.update',
      targetType: 'role',
      targetId: id,
      meta: { changes: set },
    });
    const capsChanged =
      dto.permissions !== undefined &&
      !sameCapabilities(role.permissions, dto.permissions);
    if (capsChanged || renaming) {
      await this.session.markClaimsStaleForUsers(await this.holderIds(role));
    }
    return updated;
  }

  /**
   * Users whose token claims come from `role`: `roleId` = the role. For the Member preset also
   * every user whose `roleId` is unset or points at no existing role — ClaimsService falls back
   * to Member for them.
   */
  private async holderIds(role: RoleDocument): Promise<string[]> {
    let filter: Record<string, unknown> = { roleId: role._id };
    if (role.name === MEMBER_ROLE_NAME) {
      const others = await this.roleModel
        .find({ _id: { $ne: role._id } }, { _id: 1 })
        .lean()
        .exec();
      // $nin also matches a missing / null roleId.
      filter = { roleId: { $nin: (others ?? []).map((r) => r._id) } };
    }
    const users = await this.userModel.find(filter, { _id: 1 }).lean().exec();
    return (users ?? []).map((u) => String(u._id));
  }

  /**
   * Whether `role` is the actor's own role: by the token's role NAME (unique) or by the actor's
   * stored roleId (the token can be up to one access-token lifetime stale). A user with no
   * roleId effectively holds Member (ClaimsService falls back to it).
   */
  private async actorHoldsRole(
    actor: RoleActor,
    role: RoleDocument,
  ): Promise<boolean> {
    if (actor.role === role.name) return true;
    if (!isObjectIdString(actor.sub)) return false;
    const me = await this.userModel
      .findById(actor.sub)
      .select('roleId')
      .lean()
      .exec();
    if (!me) return false;
    if (!me.roleId) return role.name === MEMBER_ROLE_NAME;
    return String(me.roleId) === String(role._id);
  }
}

/** Same enabled-capability set (what ClaimsService puts into `perms`). */
function sameCapabilities(
  a: PermissionMatrix | null | undefined,
  b: PermissionMatrix | null | undefined,
): boolean {
  const x = enabledCapabilities(a ?? {});
  const y = new Set(enabledCapabilities(b ?? {}));
  return x.length === y.size && x.every((cap) => y.has(cap));
}
