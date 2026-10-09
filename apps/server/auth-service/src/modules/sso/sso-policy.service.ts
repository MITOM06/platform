import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import {
  Role,
  RoleDocument,
  User,
  UserDocument,
  Workspace,
  WorkspaceDocument,
} from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { isOidcConfiguredByEnv } from '../auth/oidc/oidc-env';
import { SsoInfoResponseDto } from './dto/sso-info.dto';
import { emailInDomains, isEnforcementActive, SsoSettings } from './sso-policy';

const OWNER_ROLE_NAME = 'Owner';

/** A member, or a prospective one (an invitation: its email + role). */
export interface SsoSubject {
  email?: string | null;
  roleId?: unknown;
  isBot?: boolean | null;
}

/** 403 SSO_REQUIRED: this member must sign in with the company SSO. */
export function ssoRequired(): ForbiddenException {
  return new ForbiddenException({ code: AuthCode.SSO_REQUIRED });
}

/**
 * "Require SSO" policy. A member is SSO-enforced when the switch is in effect
 * (see `isEnforcementActive`), their email domain is in `allowedDomains`, and
 * they are not an Owner (Owners keep password + 2FA as break-glass accounts).
 * Bot accounts are never enforced. Read on every check (no cache), so
 * switching it on or off applies to the very next request.
 */
@Injectable()
export class SsoPolicyService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<SsoSettings> {
    const ws = await this.workspaceModel.findOne().select('sso').lean().exec();
    return {
      enabled: ws?.sso?.enabled === true,
      enforced: ws?.sso?.enforced === true,
      allowedDomains: ws?.sso?.allowedDomains ?? [],
      oidcConfigured: isOidcConfiguredByEnv(this.config),
    };
  }

  /** Whether this member (or invitee) must sign in with SSO. */
  async isEnforcedFor(
    subject: SsoSubject | null | undefined,
  ): Promise<boolean> {
    if (!subject?.email || subject.isBot === true) return false;
    const settings = await this.getSettings();
    if (!isEnforcementActive(settings)) return false;
    if (!emailInDomains(subject.email, settings.allowedDomains)) return false;
    return !(await this.isOwnerRole(subject.roleId));
  }

  /** Throws 403 SSO_REQUIRED for an SSO-enforced member (or invitee). */
  async assertNotEnforced(
    subject: SsoSubject | null | undefined,
  ): Promise<void> {
    if (await this.isEnforcedFor(subject)) throw ssoRequired();
  }

  /** Same, for a signed-in user known by id (change-password). */
  async assertNotEnforcedForUserId(userId: string): Promise<void> {
    const user = isValidObjectId(userId)
      ? await this.userModel
          .findById(userId)
          .select('email roleId isBot')
          .lean()
          .exec()
      : null;
    await this.assertNotEnforced(user);
  }

  /** Public `GET /auth/sso/info`: no domain list is exposed. */
  async publicInfo(): Promise<SsoInfoResponseDto> {
    const settings = await this.getSettings();
    const enabled = settings.oidcConfigured && settings.enabled;
    return {
      enabled,
      enforced: isEnforcementActive(settings),
      loginUrl: enabled ? '/auth/oidc/login' : null,
      buttonLabel: 'Sign in with SSO',
    };
  }

  private async isOwnerRole(roleId: unknown): Promise<boolean> {
    // ObjectId (or its string form) of the user's / invitation's role.
    const id =
      typeof roleId === 'string'
        ? roleId
        : ((roleId as { toString?: () => string } | null)?.toString?.() ?? '');
    if (!id || !isValidObjectId(id)) return false;
    const role = await this.roleModel.findById(id).select('name').lean().exec();
    return role?.name === OWNER_ROLE_NAME;
  }
}
