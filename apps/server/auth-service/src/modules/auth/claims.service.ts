import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  User,
  UserDocument,
  Role,
  RoleDocument,
  Capability,
  PermissionMatrix,
  enabledCapabilities,
} from '@platform/database';

export interface ResolvedClaims {
  role: string;
  perms: Capability[];
  depts: string[];
}

const DEFAULT_CLAIMS: ResolvedClaims = {
  role: 'Member',
  perms: [],
  depts: [],
};

const MEMBER_ROLE = 'Member';
const MEMBER_CACHE_MS = 60_000;

/**
 * Resolves a user's RBAC claims (role name, enabled capability keys, department
 * ids) for embedding into the JWT access token. Kept tiny and read-only so it
 * can be called on every token issue/refresh cheaply.
 */
@Injectable()
export class ClaimsService {
  /** Cached preset-Member capabilities (fallback for role-less users). */
  private memberCache: { perms: Capability[]; at: number } | null = null;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async resolve(userId: string): Promise<ResolvedClaims> {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) return { ...DEFAULT_CLAIMS };

    const depts = (user.departmentIds ?? []).map((d) => d.toString());

    // No role / dangling role (legacy or JIT users, role deleted after invite):
    // grant the preset Member role's capabilities — the least-privileged preset.
    if (!user.roleId) {
      return { role: MEMBER_ROLE, perms: await this.memberPerms(), depts };
    }

    const role = await this.roleModel
      .findById(user.roleId.toString())
      .lean()
      .exec();
    if (!role) {
      return { role: MEMBER_ROLE, perms: await this.memberPerms(), depts };
    }

    const perms = enabledCapabilities(
      (role.permissions ?? {}) as PermissionMatrix,
    );
    return { role: role.name, perms, depts };
  }

  private async memberPerms(): Promise<Capability[]> {
    const now = Date.now();
    if (this.memberCache && now - this.memberCache.at < MEMBER_CACHE_MS) {
      return [...this.memberCache.perms];
    }
    const member = await this.roleModel
      .findOne({ name: MEMBER_ROLE })
      .lean()
      .exec();
    const perms = member
      ? enabledCapabilities((member.permissions ?? {}) as PermissionMatrix)
      : [];
    this.memberCache = { perms, at: now };
    return [...perms];
  }
}
