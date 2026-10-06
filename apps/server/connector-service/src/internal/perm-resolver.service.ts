import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Capability,
  enabledCapabilities,
  PermissionMatrix,
  Role,
  RoleDocument,
  User,
  UserDocument,
} from '@platform/database';

/** A member's live standing, read from the shared `platform` db. */
export interface MemberAccess {
  exists: boolean;
  /** `users.status === 'active'` (a missing status on legacy docs counts as active). */
  active: boolean;
  /** Enabled capabilities; always empty for a missing or non-active member. */
  perms: Set<Capability>;
}

const MEMBER_ROLE = 'Member';
const MEMBER_CACHE_MS = 60_000;
const NO_ACCESS = (): MemberAccess => ({ exists: false, active: false, perms: new Set() });

/**
 * Resolves a member's standing directly from the shared `platform` Mongo db
 * (connector-service shares it with auth-service), so governance is enforced
 * on paths that carry no JWT — the internal tools API, the Bot Factory MCP
 * endpoint and the public OAuth callbacks.
 *
 * Mirrors auth-service `ClaimsService`: a member with no role (or a dangling
 * role id) gets the preset Member role's capabilities. Any lookup error fails
 * closed (no capabilities).
 */
@Injectable()
export class PermResolverService {
  private readonly logger = new Logger(PermResolverService.name);
  private memberCache: { perms: Capability[]; at: number } | null = null;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async resolveMember(userId: string): Promise<MemberAccess> {
    if (typeof userId !== 'string' || !userId) return NO_ACCESS();
    try {
      const user = await this.userModel
        .findById(userId, { roleId: 1, status: 1 })
        .lean<{ roleId?: unknown; status?: string }>();
      if (!user) return NO_ACCESS();
      const active = (user.status ?? 'active') === 'active';
      if (!active) return { exists: true, active: false, perms: new Set() };
      return { exists: true, active: true, perms: new Set(await this.rolePerms(user.roleId)) };
    } catch (err) {
      this.logger.warn(`resolveMember failed for ${userId}: ${(err as Error).message}`);
      return NO_ACCESS();
    }
  }

  /** Enabled capabilities of an ACTIVE member (empty otherwise). */
  async resolvePerms(userId: string): Promise<Set<Capability>> {
    return (await this.resolveMember(userId)).perms;
  }

  private async rolePerms(roleId: unknown): Promise<Capability[]> {
    if (!roleId) return this.memberPerms();
    const role = await this.roleModel
      .findById(roleId)
      .lean<{ permissions?: PermissionMatrix }>();
    if (!role) return this.memberPerms();
    return enabledCapabilities(role.permissions ?? {});
  }

  private async memberPerms(): Promise<Capability[]> {
    const now = Date.now();
    if (this.memberCache && now - this.memberCache.at < MEMBER_CACHE_MS) {
      return [...this.memberCache.perms];
    }
    const member = await this.roleModel
      .findOne({ name: MEMBER_ROLE })
      .lean<{ permissions?: PermissionMatrix }>();
    const perms = member ? enabledCapabilities(member.permissions ?? {}) : [];
    this.memberCache = { perms, at: now };
    return [...perms];
  }
}
