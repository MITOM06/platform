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

/**
 * Seeds the single-deployment enterprise foundation on startup:
 *   1. the singleton Workspace config doc,
 *   2. the preset Role templates (Owner/Admin/Manager/Member),
 *   3. the first Owner (a user matching BOOTSTRAP_OWNER_EMAIL with no role yet).
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

  /** Idempotently seed the preset roles, matched by unique name. */
  private async ensurePresetRoles(): Promise<void> {
    for (const preset of PRESET_ROLES) {
      await this.roleModel.updateOne(
        { name: preset.name },
        {
          $set: { isPreset: preset.isPreset, permissions: preset.permissions },
          $setOnInsert: { name: preset.name },
        },
        { upsert: true },
      );
    }
    this.logger.log(`Ensured ${PRESET_ROLES.length} preset roles`);
  }

  /**
   * If BOOTSTRAP_OWNER_EMAIL matches an existing user that has no role yet,
   * assign the Owner role. Never overwrites an already-assigned role.
   */
  private async ensureBootstrapOwner(): Promise<void> {
    const email = this.configService.get<string>('BOOTSTRAP_OWNER_EMAIL');
    if (!email) return;

    const user = await this.userModel.findOne({ email }).exec();
    if (!user || user.roleId) return;

    const ownerRole = await this.roleModel.findOne({ name: 'Owner' }).exec();
    if (!ownerRole) return;

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { roleId: ownerRole._id } },
    );
    this.logger.log(`Assigned Owner role to bootstrap owner ${email}`);
  }
}
