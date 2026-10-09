import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { SessionMethod, SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
import { AuthCode } from '../../common/auth-code.enum';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertCanSignIn } from './account-status';
import { LoginAttemptsService } from './login-attempts.service';
import {
  loginCodeKey,
  OAuthRedirectService,
  parseLoginCode,
} from './oauth-redirect.service';
import {
  MfaChallengeService,
  MfaChallengeUser,
} from '../mfa/mfa-challenge.service';
import {
  SocialProfile,
  SocialProvider,
  SocialProvisioningService,
} from './social-provisioning.service';
import { SsoPolicyService, ssoRequired } from '../sso/sso-policy.service';
import { PasswordRecoveryService } from './password-recovery.service';

/** A user as needed to mint a session (any UserDocument satisfies it). */
interface TokenSubject {
  _id: unknown;
  email: string;
  displayName: string;
  phoneVerified?: boolean;
  mustSetPassword?: boolean;
  roleId?: unknown;
  isBot?: boolean;
}

/** Where a sign-in comes from: device fields + how the first factor passed. */
export interface SignInContext {
  deviceId: string;
  platform: string;
  method: SessionMethod;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly claims: ClaimsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly ssoMapping: SsoMappingService,
    private readonly notificationsService: NotificationsService,
    private readonly socialProvisioning: SocialProvisioningService,
    private readonly oauthRedirect: OAuthRedirectService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly mfaChallenge: MfaChallengeService,
    private readonly ssoPolicy: SsoPolicyService,
    private readonly recovery: PasswordRecoveryService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Fire-and-forget setup-notification nudge after a successful login.
   * Resolves whether a local password exists, then asks the notifications
   * service to (idempotently) create PASSWORD_SETUP / PHONE_SETUP nudges.
   * Never awaited by callers and never throws — login latency/flow is unaffected.
   */
  private triggerSetupNotifications(
    userId: string,
    phoneVerified: boolean,
  ): void {
    void this.usersService
      .getHasPassword(userId)
      .then((hasPassword) =>
        this.notificationsService.createSetupNotificationsIfNeeded(userId, {
          hasPassword,
          phoneVerified,
        }),
      )
      .catch(() => {
        /* silent — a notification failure must never break login */
      });
  }

  // ===================== SOCIAL LOGIN =====================
  async handleSocialLogin(
    user: SocialProfile,
    res: Response,
    provider: SocialProvider,
    platform: string = 'mobile',
  ) {
    const userId = await this.socialProvisioning.resolveUserId(user, provider);
    return this.oauthRedirect.redirectWithLoginCode(userId, res, platform);
  }

  // ===================== OIDC SSO =====================
  async handleOidcLogin(
    profile: {
      email: string;
      displayName: string;
      id: string;
      groups: string[];
    },
    res: Response,
    platform: string,
  ) {
    const gate = await this.ssoMapping.getGate();
    if (!gate.enabled)
      throw new UnauthorizedException({ code: AuthCode.SSO_DISABLED });

    // Enforce allowed email domains if configured (empty list = any domain).
    if (gate.allowedDomains.length > 0) {
      const domain = profile.email.split('@')[1]?.toLowerCase();
      const ok = gate.allowedDomains.some((d) => d.toLowerCase() === domain);
      if (!ok) {
        throw new UnauthorizedException({
          code: AuthCode.SSO_DOMAIN_NOT_ALLOWED,
        });
      }
    }

    // JIT provisioning only for an explicit, admin-configured domain allow-list:
    // an empty list means "any domain" and must not become an open sign-up.
    const userId = await this.socialProvisioning.resolveUserId(
      profile,
      'oidc',
      {
        allowJit: gate.allowedDomains.length > 0,
      },
    );
    const { changed } = await this.ssoMapping.apply(
      userId,
      profile.email,
      profile.groups,
    );
    if (changed) {
      // role/dept changed → invalidate existing sessions so new claims take effect.
      await this.session.revokeAllSessions(userId, 'role_changed');
    }
    // 'oidc' grant: exchange skips PON 2FA (the IdP owns MFA for SSO).
    return this.oauthRedirect.redirectWithLoginCode(
      userId,
      res,
      platform,
      'oidc',
    );
  }

  // ===================== LOGIN / LOGOUT =====================
  async login(dto: LoginDto, locale: string = 'en') {
    await this.loginAttempts.checkBruteForce(dto.email);
    const user = await this.usersService.findByEmail(dto.email);

    // Require SSO: refused BEFORE the password is compared or a failed attempt
    // is counted, so the answer says nothing about the password. An unknown
    // email in an enforced domain gets the same answer (no enumeration there).
    await this.ssoPolicy.assertNotEnforced(user ?? { email: dto.email });

    if (!user) {
      await this.loginAttempts.handleFailedLogin(dto.email); // always throws
      return; // unreachable
    }

    // Google-only accounts have no local password: a failed attempt, not a 500.
    const isMatch =
      !!user.password && (await bcrypt.compare(dto.password, user.password));
    if (!isMatch) {
      await this.loginAttempts.handleFailedLogin(dto.email);
      return; // unreachable
    }

    // Correct credentials but a blocked / not-yet-accepted account: the attempt
    // was not a guess, so clear the counter, then refuse (403).
    if (user.status === 'blocked' || user.status === 'pending') {
      await this.loginAttempts.reset(dto.email);
      assertCanSignIn(user);
    }

    // ── SECURITY: an unverified account must never receive a session. ──
    if (!user.isVerified)
      return this.recovery.rejectUnverifiedLogin(user, locale);

    await this.loginAttempts.reset(dto.email);
    return this.startSignIn(user, {
      deviceId: 'web-login',
      platform: 'web',
      method: 'password',
    });
  }

  /**
   * First factor passed (password, Google, invitation password): the 2FA step
   * (`MFA_REQUIRED`, no session yet) for an Owner / Admin-like role or a
   * member who turned 2FA on; otherwise tokens (`LOGIN_SUCCESS`).
   */
  async startSignIn(user: TokenSubject & MfaChallengeUser, ctx: SignInContext) {
    const mfa = await this.mfaChallenge.challengeIfRequired(user, ctx);
    if (mfa) return mfa;
    const tokens = await this.issueTokensForUser(
      user,
      ctx.deviceId,
      ctx.platform,
      ctx.method,
    );
    return { code: AuthCode.LOGIN_SUCCESS, ...tokens };
  }

  /**
   * Create a session + RBAC-claims access token for an already-authenticated
   * user. Returns the LoginTokens shape. The single place sessions are minted:
   * a member covered by "Require SSO" gets only `oidc` sessions (403
   * SSO_REQUIRED otherwise, e.g. when enforcement was switched on during their
   * 2FA step), and their `mustSetPassword` gate is off.
   */
  async issueTokensForUser(
    user: TokenSubject,
    deviceId: string,
    platform: string,
    method: SessionMethod,
  ) {
    const userId = String(user._id);
    const ssoEnforced = await this.ssoPolicy.isEnforcedFor(user);
    if (ssoEnforced && method !== 'oidc') throw ssoRequired();

    const { sid, refreshToken } = await this.session.createSession({
      userId,
      deviceId,
      platform,
      method,
    });
    const accessToken = await this.signAccessTokenWithClaims(userId, sid);

    // Fire-and-forget: nudge the user to set a password / verify their phone.
    this.triggerSetupNotifications(userId, user.phoneVerified ?? false);

    return {
      accessToken,
      refreshToken,
      sid,
      user: {
        id: userId,
        email: user.email,
        displayName: user.displayName,
        mustSetPassword: user.mustSetPassword === true && !ssoEnforced,
      },
    };
  }

  async logout(userId: string, sid: string) {
    await this.session.revokeSession(userId, sid);
    return {
      success: true,
      code: AuthCode.LOGOUT_SUCCESS,
    };
  }

  // ===================== JWT / SESSION =====================
  signAccessToken(payload: {
    sub: string;
    sid: string;
    role?: string;
    perms?: string[];
    depts?: string[];
  }) {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    // Fall back to 15m so a missing JWT_ACCESS_EXPIRES env never breaks token signing
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m';
    const options: JwtSignOptions = { secret, expiresIn: expiresIn as any };

    // Only embed RBAC claims when present, keeping minimal tokens minimal and
    // backward-compatible with in-flight tokens that lack these fields.
    const claims: Record<string, unknown> = {
      sub: payload.sub,
      sid: payload.sid,
    };
    if (payload.role !== undefined) claims.role = payload.role;
    if (payload.perms !== undefined) claims.perms = payload.perms;
    if (payload.depts !== undefined) claims.depts = payload.depts;

    return this.jwt.sign(claims, options);
  }

  // Resolve the user's RBAC claims and sign a token that carries them.
  private async signAccessTokenWithClaims(sub: string, sid: string) {
    const { role, perms, depts } = await this.claims.resolve(sub);
    return this.signAccessToken({ sub, sid, role, perms, depts });
  }

  async exchangeLoginCode(code: string, deviceId?: string, platform?: string) {
    // GETDEL: the code is single-use even under concurrent exchanges.
    const grant = parseLoginCode(await this.redis.getdel(loginCodeKey(code)));
    const invalid = { code: AuthCode.LOGIN_CODE_INVALID };
    if (!grant) throw new UnauthorizedException(invalid);
    const userId = grant.userId;

    // Re-check the account between OAuth callback and exchange (deleted / blocked).
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException(invalid);
    assertCanSignIn(user);

    // A legacy code (no `via`, minted before 2FA shipped) counts as Google.
    const ctx: SignInContext = {
      deviceId: deviceId || 'unknown',
      platform: platform || 'web',
      method: grant.via === 'oidc' ? 'oidc' : 'google',
    };
    // Google sign-in → Require SSO, then the 2FA step (if due). OIDC SSO is exempt from both.
    if (ctx.method !== 'oidc') {
      await this.ssoPolicy.assertNotEnforced(user);
      const mfa = await this.mfaChallenge.challengeIfRequired(user, ctx);
      if (mfa) return mfa;
    }
    const tokens = await this.issueTokensForUser(
      user,
      ctx.deviceId,
      ctx.platform,
      ctx.method,
    );
    return {
      userId,
      sid: tokens.sid,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        mustSetPassword: tokens.user.mustSetPassword,
      },
    };
  }

  async refresh(sid: string, refreshToken: string) {
    // Status BEFORE session validity: blocking revokes every session, so rotating
    // first would answer SESSION_REVOKED instead of 403 ACCOUNT_BLOCKED.
    await this.assertRefreshOwnerCanSignIn(sid, refreshToken);
    const { userId, newRefreshToken } = await this.session.rotateRefreshToken({
      sid,
      refreshToken,
    });
    const accessToken = await this.signAccessTokenWithClaims(userId, sid);
    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Blocked / pending owner → revoke all sessions + 403. A non-SSO session of a
   * member covered by "Require SSO" → revoke their non-SSO sessions + 403
   * SSO_REQUIRED (the client shows "use SSO" instead of a plain logout). Only
   * revealed to a caller holding a genuine (current or previous) refresh token
   * of this session.
   */
  private async assertRefreshOwnerCanSignIn(sid: string, refreshToken: string) {
    const peek = await this.session.peekSession(sid);
    if (!peek) return;
    const user = await this.usersService.findById(peek.userId);
    if (!user) return;
    const inactive = user.status === 'blocked' || user.status === 'pending';
    const ssoOnly =
      !inactive &&
      peek.method !== 'oidc' &&
      (await this.ssoPolicy.isEnforcedFor(user));
    if (!inactive && !ssoOnly) return;
    if (!(await this.session.refreshTokenBelongsToSession(sid, refreshToken))) {
      return;
    }
    if (ssoOnly) {
      await this.session.revokeSessionsNotCreatedBy(
        peek.userId,
        'oidc',
        'sso_enforced',
      );
      throw ssoRequired();
    }
    await this.session.revokeAllSessions(
      peek.userId,
      user.status === 'blocked' ? 'blocked' : 'other',
    );
    assertCanSignIn(user);
  }
}
