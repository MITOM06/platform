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

/**
 * Resolves a user's RBAC claims (role name, enabled capability keys, department
 * ids) for embedding into the JWT access token. Kept tiny and read-only so it
 * can be called on every token issue/refresh cheaply.
 */
@Injectable()
export class ClaimsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async resolve(userId: string): Promise<ResolvedClaims> {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) return { ...DEFAULT_CLAIMS };

    const depts = (user.departmentIds ?? []).map((d) => d.toString());

    if (!user.roleId) {
      return { role: 'Member', perms: [], depts };
    }

    const role = await this.roleModel
      .findById(user.roleId.toString())
      .lean()
      .exec();
    if (!role) {
      return { role: 'Member', perms: [], depts };
    }

    const perms = enabledCapabilities(
      (role.permissions ?? {}) as PermissionMatrix,
    );
    return { role: role.name, perms, depts };
  }
}
