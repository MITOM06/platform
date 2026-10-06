import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  Workspace,
  WorkspaceDocument,
  Role,
  RoleDocument,
  User,
  UserDocument,
  PRESET_ROLES,
} from '@platform/database';
import { InvitationsService } from '../invitations/invitations.service';
import { OWNER_ROLE } from '../invitations/invitation.shared';

/**
 * Seeds the single-deployment enterprise foundation on startup:
 *   1. the singleton Workspace config doc,
 *   2. the preset Role templates (Owner/Admin/Manager/Member) — Owner forced to
 *      the full matrix, the others only gain missing capability keys,
 *   3. the first Owner (a user matching BOOTSTRAP_OWNER_EMAIL with no role yet),
 *      or — when no such user exists — an Owner invitation emailed to it.
 *
 * Every step is idempotent — running it twice yields exactly one workspace and
 * four roles, so it is safe to re-run on every boot and on every redeploy.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly invitations: InvitationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureWorkspace();
    await this.ensurePresetRoles();
    await this.ensureBootstrapOwner();
  }

  /** Upsert the singleton workspace (created once, name is not overwritten on re-run). */
  private async ensureWorkspace(): Promise<void> {
    const count = await this.workspaceModel.countDocuments().exec();
    if (count > 0) return;

    const name =
      this.configService.get<string>('WORKSPACE_NAME') || 'PON Workspace';
    await this.workspaceModel.create({
      name,
      features: {},
      connectorAllowList: [],
    });
    this.logger.log(`Bootstrapped singleton workspace "${name}"`);
  }

  /**
   * Idempotently seed the preset roles, matched by unique name.
   *
   * Only the Owner's matrix is forced (it must always hold every capability,
   * including ones added in a later release). Admin / Manager / Member are
   * admin-editable, so an existing role keeps every stored value and only gains
   * the capability keys it does not have yet, at the preset default — the old
   * unconditional `$set` silently reverted every edit on each boot/redeploy.
   * The merge runs as an update pipeline, so it is atomic and still upserts a
   * fresh preset on first boot.
   */
  private async ensurePresetRoles(): Promise<void> {
    for (const preset of PRESET_ROLES) {
      if (preset.name === OWNER_ROLE) {
        await this.roleModel.updateOne(
          { name: preset.name },
          {
            $set: { isPreset: true, permissions: preset.permissions },
            $setOnInsert: { name: preset.name },
          },
          { upsert: true },
        );
        continue;
      }
      await this.roleModel.updateOne(
        { name: preset.name },
        [
          {
            $set: {
              isPreset: true,
              // Later objects win: stored values override the preset defaults.
              permissions: {
                $mergeObjects: [
                  preset.permissions,
                  { $ifNull: ['$permissions', {}] },
                ],
              },
              // Mongoose only appends updatedAt to pipeline updates.
              createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
            },
          },
        ],
        { upsert: true },
      );
    }
    this.logger.log(`Ensured ${PRESET_ROLES.length} preset roles`);
  }

  /**
   * If BOOTSTRAP_OWNER_EMAIL matches an existing user that has no role yet,
   * assign the Owner role. Never overwrites an already-assigned role.
   * With invite-only onboarding there is no sign-up, so when no user exists
   * an Owner invitation is created + emailed (idempotent; never blocks boot).
   */
  private async ensureBootstrapOwner(): Promise<void> {
    const email = this.configService.get<string>('BOOTSTRAP_OWNER_EMAIL');
    if (!email) return;

    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      await this.ensureBootstrapOwnerInvite(email);
      return;
    }
    if (user.roleId) return;

    const ownerRole = await this.roleModel.findOne({ name: OWNER_ROLE }).exec();
    if (!ownerRole) return;

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { roleId: ownerRole._id } },
    );
    this.logger.log(`Assigned Owner role to bootstrap owner ${email}`);
  }

  private async ensureBootstrapOwnerInvite(email: string): Promise<void> {
    try {
      await this.invitations.createBootstrapOwnerInvite(email);
    } catch (err) {
      this.logger.warn(
        `Bootstrap owner invitation skipped: ${err instanceof Error ? err.name : typeof err}`,
      );
    }
  }
}
