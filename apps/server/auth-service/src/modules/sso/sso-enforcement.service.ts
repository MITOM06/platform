import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument, User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import {
  escapeRegExp,
  isEnforcementActive,
  normalizeDomains,
  SsoSettings,
} from './sso-policy';
import { SsoPolicyService } from './sso-policy.service';

/** The `sso` object of PATCH /admin/workspace (replaces the stored one). */
export interface WorkspaceSsoPatch {
  enabled?: boolean;
  enforced?: boolean;
  allowedDomains?: string[];
  groupRoleMap?: Record<string, string>;
  groupDeptMap?: Record<string, string>;
  defaultRole?: string;
}

/** A validated SSO update: what to store, and the switches before / after. */
export interface SsoUpdatePlan {
  sso: WorkspaceSsoPatch & { enforced: boolean };
  before: SsoSettings;
  after: SsoSettings;
}

/**
 * The admin side of "Require SSO": validates the switch when the workspace SSO
 * settings are saved, and signs members out of their non-SSO sessions when it
 * takes effect for them.
 */
@Injectable()
export class SsoEnforcementService {
  private readonly logger = new Logger(SsoEnforcementService.name);

  constructor(
    private readonly policy: SsoPolicyService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly session: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Validates an `sso` patch. The patch replaces the stored object (as
   * before), except `enforced`: when omitted (older clients) the stored value
   * is kept, so saving SSO settings never switches enforcement off silently.
   * If `enforced` ends up true, SSO must be enabled with at least one allowed
   * domain and OIDC configured by env, else 400 SSO_ENFORCE_NOT_READY (to turn
   * SSO off, send `enforced: false` with it).
   */
  async plan(patch: WorkspaceSsoPatch): Promise<SsoUpdatePlan> {
    const before = await this.policy.getSettings();
    const enforced =
      typeof patch.enforced === 'boolean' ? patch.enforced : before.enforced;
    const after: SsoSettings = {
      enabled: patch.enabled === true,
      enforced,
      allowedDomains: patch.allowedDomains ?? [],
      oidcConfigured: before.oidcConfigured,
    };
    if (enforced && !isEnforcementActive(after)) {
      throw new BadRequestException({ code: AuthCode.SSO_ENFORCE_NOT_READY });
    }
    return { sso: { ...patch, enforced }, before, after };
  }

  /**
   * After the workspace was saved. When enforcement takes effect (switched on,
   * or a domain was added while on), every non-SSO session (`method !==
   * 'oidc'`, incl. sessions from before methods were recorded) of the members
   * it now covers is revoked with reason `sso_enforced`. Owners are exempt.
   */
  async apply(plan: SsoUpdatePlan, actorId: string): Promise<void> {
    const wasActive = isEnforcementActive(plan.before);
    const nowActive = isEnforcementActive(plan.after);
    let domains: string[] = [];
    if (nowActive) {
      const after = normalizeDomains(plan.after.allowedDomains);
      const before = new Set(normalizeDomains(plan.before.allowedDomains));
      domains = wasActive ? after.filter((d) => !before.has(d)) : after;
    }
    const membersSignedOut = domains.length
      ? await this.revokeNonSsoSessions(domains)
      : 0;

    if (wasActive !== nowActive || membersSignedOut > 0) {
      this.logger.log(
        `Require SSO ${nowActive ? 'on' : 'off'}; signed out non-SSO sessions of ${membersSignedOut} member(s)`,
      );
      await this.audit.record({
        actorId,
        action: 'sso.enforcement_changed',
        targetType: 'workspace',
        meta: { enforced: nowActive, domains, membersSignedOut },
      });
    }
  }

  /** Revokes the non-SSO sessions of non-Owner people in `domains`; returns how many were affected. */
  async revokeNonSsoSessions(domains: string[]): Promise<number> {
    const owner = await this.roleModel
      .findOne({ name: 'Owner' })
      .select('_id')
      .lean()
      .exec();
    const pattern = new RegExp(
      `@(${domains.map(escapeRegExp).join('|')})$`,
      'i',
    );
    const filter: Record<string, unknown> = {
      email: pattern,
      isBot: { $ne: true },
    };
    if (owner) filter.roleId = { $ne: owner._id };
    const members = await this.userModel
      .find(filter)
      .select('_id')
      .lean()
      .exec();

    let affected = 0;
    for (const m of members) {
      const n = await this.session.revokeSessionsNotCreatedBy(
        String(m._id),
        'oidc',
        'sso_enforced',
      );
      if (n > 0) affected += 1;
    }
    return affected;
  }
}
