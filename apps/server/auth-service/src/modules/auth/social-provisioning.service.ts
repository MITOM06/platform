import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Role, RoleDocument, User } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { UsersService } from '../users/users.service';
import { InvitationsService } from '../invitations/invitations.service';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { normalizeEmail } from '../invitations/invitation.shared';
import { assertCanSignIn } from './account-status';

export type SocialProvider = 'google' | 'oidc';

/** Normalized social/OIDC profile (Google strategy + OidcService both produce this shape). */
export interface SocialProfile {
  id?: string;
  email?: string;
  displayName?: string;
  name?: string;
  avatar?: string;
  picture?: string;
  photos?: { value?: string }[];
}

/**
 * Resolves a social / SSO identity to a PON user id under invite-only rules:
 *   - existing user (by provider id, else case-insensitive email) → status check
 *     → link the provider if missing;
 *   - no user + BOOTSTRAP_OWNER_EMAIL → create the first Owner;
 *   - no user + `allowJit` (SSO with an explicit domain allow-list) → JIT create,
 *     consuming a live invitation if one exists;
 *   - no user + live invitation → 403 INVITATION_PENDING;
 *   - otherwise → 403 ACCOUNT_NOT_PROVISIONED.
 */
@Injectable()
export class SocialProvisioningService {
  private readonly logger = new Logger(SocialProvisioningService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly invitations: InvitationsService,
    private readonly invitationAccept: InvitationAcceptService,
    private readonly configService: ConfigService,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async resolveUserId(
    profile: SocialProfile,
    provider: SocialProvider,
    opts: { allowJit?: boolean } = {},
  ): Promise<string> {
    if (!profile?.email) {
      throw new UnauthorizedException({
        code: AuthCode.SOCIAL_EMAIL_UNAVAILABLE,
      });
    }
    const email = normalizeEmail(profile.email);

    let user = profile.id
      ? await this.usersService.findBySocialId(provider, profile.id)
      : null;
    if (!user) user = await this.usersService.findByEmailInsensitive(email);

    if (user) {
      assertCanSignIn(user);
      if (profile.id && !user.socialLinks?.[provider]) {
        await this.usersService.updateSocialId(
          user._id.toString(),
          provider,
          profile.id,
        );
      }
      return user._id.toString();
    }

    const base = this.newUserFields(profile, provider, email);

    if (this.isBootstrapOwner(email)) {
      const ownerRole = await this.roleModel.findOne({ name: 'Owner' }).exec();
      const created = await this.usersService.create({
        ...base,
        ...(ownerRole ? { roleId: ownerRole._id as User['roleId'] } : {}),
      });
      const createdId = created._id.toString();
      // A boot-time Owner invitation may be outstanding — it is now fulfilled.
      const pending = await this.invitations.findPendingByEmail(email);
      if (pending)
        await this.invitationAccept.consumeForUser(
          pending._id,
          createdId,
          provider,
        );
      this.logger.log(`Provisioned bootstrap owner via ${provider}`);
      return createdId;
    }

    const pending = await this.invitations.findPendingByEmail(email);

    if (opts.allowJit) {
      const created = pending
        ? await this.invitationAccept.acceptWithSso(pending, base)
        : await this.usersService.create(base);
      return created._id.toString();
    }

    if (pending) {
      throw new ForbiddenException({ code: AuthCode.INVITATION_PENDING });
    }
    throw new ForbiddenException({ code: AuthCode.ACCOUNT_NOT_PROVISIONED });
  }

  private isBootstrapOwner(email: string): boolean {
    const owner = this.configService.get<string>('BOOTSTRAP_OWNER_EMAIL');
    return !!owner && normalizeEmail(owner) === email;
  }

  private newUserFields(
    profile: SocialProfile,
    provider: SocialProvider,
    email: string,
  ): Partial<User> {
    return {
      displayName: profile.displayName || profile.name || email.split('@')[0],
      email,
      avatarUrl:
        profile.avatar || profile.picture || profile.photos?.[0]?.value || '',
      isVerified: true,
      status: 'active',
      ...(profile.id ? { socialLinks: { [provider]: profile.id } } : {}),
    };
  }
}
