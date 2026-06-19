import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Capability,
  enabledCapabilities,
  Role,
  RoleDocument,
  User,
  UserDocument,
} from '@platform/database';

/**
 * Resolves a member's enabled capability set directly from the shared `platform`
 * Mongo db (connector-service shares the database with auth-service). This lets
 * connector-service enforce tool-exposure governance WITHOUT ai-service or the
 * JWT being involved on the internal API path: it reads `User.roleId` ->
 * `Role.permissions` -> enabled capabilities.
 *
 * A user with no role (or no matching role doc) resolves to the empty set, so
 * capability-gated tools (sensitive skills) are denied by default.
 */
@Injectable()
export class PermResolverService {
  private readonly logger = new Logger(PermResolverService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async resolvePerms(userId: string): Promise<Set<Capability>> {
    try {
      const user = await this.userModel
        .findById(userId)
        .lean<{ roleId?: unknown }>();
      if (!user?.roleId) return new Set();

      const role = await this.roleModel
        .findById(user.roleId)
        .lean<{ permissions?: Record<string, boolean> }>();
      if (!role?.permissions) return new Set();

      return new Set(enabledCapabilities(role.permissions));
    } catch (err) {
      // Fail closed: on any lookup error, grant no capabilities.
      this.logger.warn(
        `resolvePerms failed for ${userId}: ${(err as Error).message}`,
      );
      return new Set();
    }
  }
}
