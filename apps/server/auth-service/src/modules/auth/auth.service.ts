import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { randomInt, createHash } from 'node:crypto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../Email/mail.service';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';
import { Response } from 'express';
import { AuthCode } from '../../common/auth-code.enum';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertCanSignIn } from './account-status';
import { LoginAttemptsService } from './login-attempts.service';
import { loginCodeKey, OAuthRedirectService } from './oauth-redirect.service';
import {
  SocialProfile,
  SocialProvider,
  SocialProvisioningService,
} from './social-provisioning.service';

/** A user as needed to mint a session (any UserDocument satisfies it). */
interface TokenSubject {
  _id: unknown;
  email: string;
  displayName: string;
  phoneVerified?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly mailService: MailService,
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

  // Cryptographically secure 6-digit OTP (100000–999999).
  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * One-way hash of an OTP before it is persisted. SHA-256 (not bcrypt) is the
   * right tool here: OTPs are short-lived (5 min) and brute-force is already
   * rate-limited at the verify layer, so we only need to ensure a DB dump can't
   * reveal live OTPs. Compare hash-to-hash; never store or match the raw code.
   */
  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
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
    profile: { email: string; displayName: string; id: string; groups: string[] },
    res: Response,
    platform: string,
  ) {
    const gate = await this.ssoMapping.getGate();
    if (!gate.enabled) throw new UnauthorizedException({ code: AuthCode.SSO_DISABLED });

    // Enforce allowed email domains if configured (empty list = any domain).
    if (gate.allowedDomains.length > 0) {
      const domain = profile.email.split('@')[1]?.toLowerCase();
      const ok = gate.allowedDomains.some((d) => d.toLowerCase() === domain);
      if (!ok) {
        throw new UnauthorizedException({ code: AuthCode.SSO_DOMAIN_NOT_ALLOWED });
      }
    }

    // JIT provisioning only for an explicit, admin-configured domain allow-list:
    // an empty list means "any domain" and must not become an open sign-up.
    const userId = await this.socialProvisioning.resolveUserId(profile, 'oidc', {
      allowJit: gate.allowedDomains.length > 0,
    });
    const { changed } = await this.ssoMapping.apply(
      userId,
      profile.email,
      profile.groups,
    );
    if (changed) {
      // role/dept changed → invalidate existing sessions so new claims take effect.
      await this.session.revokeAllSessions(userId, 'role_changed');
    }
    return this.oauthRedirect.redirectWithLoginCode(userId, res, platform);
  }

  // ===================== LOGIN / LOGOUT =====================
  async login(dto: LoginDto, locale: string = 'en') {
    await this.loginAttempts.checkBruteForce(dto.email);
    const user = await this.usersService.findByEmail(dto.email);

    // ✅ FIX: Kiểm tra user và throw ngay - TypeScript hiểu user không null sau đây
    if (!user) {
      await this.loginAttempts.handleFailedLogin(dto.email);
      // handleFailedLogin return type là 'never' → TypeScript biết code dưới không chạy
      return; // unreachable, nhưng giúp TypeScript yên tâm
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
    // Credentials are correct but the email was never confirmed (legacy
    // accounts). Resend a fresh OTP and steer the client to /verify-otp instead
    // of minting tokens. The per-email OTP rate limit (shared with
    // forgot/resend) keeps this from being an email-spam vector.
    if (!user.isVerified) {
      await this.enforceForgotOtpRateLimit(user.email);
      const otp = this.generateOtp();
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      await this.usersService.updateOtp(user._id, this.hashOtp(otp), expires);
      await this.deliverOtpEmail(user.email, otp, locale);
      throw new UnauthorizedException({
        code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
        params: { email: user.email },
      });
    }

    const tokens = await this.issueTokensForUser(user, 'web-login', 'web');
    await this.loginAttempts.reset(dto.email);
    return { code: AuthCode.LOGIN_SUCCESS, ...tokens };
  }

  /**
   * Create a session + RBAC-claims access token for an already-authenticated
   * user (password login, invitation accept). Returns the LoginTokens shape.
   */
  async issueTokensForUser(
    user: TokenSubject,
    deviceId: string,
    platform: string,
  ) {
    const userId = String(user._id);
    const { sid, refreshToken } = await this.session.createSession({
      userId,
      deviceId,
      platform,
    });
    const accessToken = await this.signAccessTokenWithClaims(userId, sid);

    // Fire-and-forget: nudge the user to set a password / verify their phone.
    this.triggerSetupNotifications(userId, user.phoneVerified ?? false);

    return {
      accessToken,
      refreshToken,
      sid,
      user: { id: userId, email: user.email, displayName: user.displayName },
    };
  }

  async logout(userId: string, sid: string) {
    await this.session.revokeSession(userId, sid);
    return {
      success: true,
      code: AuthCode.LOGOUT_SUCCESS,
    };
  }

  // ===================== FORGOT / RESET PASSWORD =====================

  /**
   * Per-email OTP send rate limit: max 3 sends per 10-minute window.
   * Shared key across forgotPassword + resendOtp so the total OTP emails to a
   * given address (regardless of which endpoint triggered them) count toward
   * one window. Guards against multi-IP spam that the global IP throttler misses.
   */
  private async enforceForgotOtpRateLimit(email: string): Promise<void> {
    const rateKey = `forgot_otp_rate:${email.toLowerCase()}`;
    const sends = await this.redis.incr(rateKey);
    if (sends === 1) {
      await this.redis.expire(rateKey, 600); // 10 min window
    }
    if (sends > 3) {
      throw new BadRequestException({ code: AuthCode.TOO_MANY_OTP_REQUESTS });
    }
  }

  /** A blocked account never gets an OTP mailed (forgot-password / resend). */
  private assertNotBlocked(user: { status?: string }): void {
    if (user.status === 'blocked') assertCanSignIn(user);
  }

  async forgotPassword(email: string, locale: string = 'en') {
    // ── Per-email rate limit: max 3 OTP sends per 10 minutes ──
    await this.enforceForgotOtpRateLimit(email);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });
    this.assertNotBlocked(user);

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateOtp(user._id, this.hashOtp(otp), expires);
    await this.deliverOtpEmail(email, otp, locale);
    return { success: true, code: AuthCode.OTP_SENT };
  }

  async verifyOtp(email: string, otp: string) {
    const maxAttempts = Number(this.configService.get('MAX_OTP_ATTEMPTS', 5));
    const attemptsTTL = Number(this.configService.get('OTP_ATTEMPTS_TTL', 300));

    // Rate limit OTP
    const attemptKey = `otp_attempts:${email}`;
    const attempts = await this.redis.incr(attemptKey);

    if (attempts === 1) {
      await this.redis.expire(attemptKey, attemptsTTL);
    }

    if (attempts > maxAttempts) {
      throw new BadRequestException({ code: AuthCode.OTP_ATTEMPTS_EXCEEDED });
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || !user.otpCode) {
      throw new BadRequestException({ code: AuthCode.OTP_INVALID });
    }

    if (!user.otpExpires || new Date() > user.otpExpires) {
      throw new BadRequestException({ code: AuthCode.OTP_EXPIRED });
    }

    if (user.otpCode !== this.hashOtp(otp)) {
      const remaining = maxAttempts - attempts;
      throw new BadRequestException({
        code: AuthCode.OTP_WRONG_WITH_REMAINING,
        params: { remaining },
      });
    }

    // OTP correct → reset counter + mark verified
    await this.redis.del(attemptKey);
    await this.usersService.setVerified(user._id.toString());
    return { success: true, code: AuthCode.OTP_VALID };
  }

  async resetPassword(email: string, otp: string, newPass: string) {
    // ✅ Verify OTP trước
    await this.verifyOtp(email, otp);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.USER_NOT_FOUND });

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(newPass, salt);

    // ✅ Update password và xóa OTP
    await this.usersService.updatePassword(user._id.toString(), hashedPass);

    // ✅ IMPROVEMENT: Revoke tất cả sessions cũ khi đổi mật khẩu
    await this.session.revokeAllSessions(user._id.toString(), 'password_reset');

    return {
      success: true,
      code: AuthCode.PASSWORD_UPDATED,
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
    const claims: Record<string, unknown> = { sub: payload.sub, sid: payload.sid };
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
    const userId = await this.redis.getdel(loginCodeKey(code));
    if (!userId) {
      throw new UnauthorizedException({ code: AuthCode.LOGIN_CODE_INVALID });
    }

    // Re-check the account between OAuth callback and exchange (deleted / blocked).
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: AuthCode.LOGIN_CODE_INVALID });
    }
    assertCanSignIn(user);

    const { sid, refreshToken } = await this.session.createSession({
      userId,
      deviceId: deviceId || 'unknown',
      platform: platform || 'web',
    });
    const accessToken = await this.signAccessTokenWithClaims(userId, sid);

    // Fire-and-forget: nudge the user to set a password / verify their phone.
    this.triggerSetupNotifications(userId, user.phoneVerified ?? false);

    return {
      userId,
      sid,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
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
   * Blocked / pending owner → revoke all sessions + 403. Only revealed to a caller
   * holding a genuine (current or previous) refresh token of this session.
   */
  private async assertRefreshOwnerCanSignIn(sid: string, refreshToken: string) {
    const userId = await this.session.peekSessionUserId(sid);
    if (!userId) return;
    const user = await this.usersService.findById(userId);
    if (!user || (user.status !== 'blocked' && user.status !== 'pending')) {
      return;
    }
    if (!(await this.session.refreshTokenBelongsToSession(sid, refreshToken))) {
      return;
    }
    await this.session.revokeAllSessions(
      userId,
      user.status === 'blocked' ? 'blocked' : 'other',
    );
    assertCanSignIn(user);
  }

  /**
   * Send an OTP email, converting a mail-provider failure into a typed 503 instead of letting it
   * escape as an untyped 500.
   *
   * The account row is already written by the time we get here, so a raw throw left the caller
   * with "Internal server error", an account they could not verify, and a retry that took the
   * "unverified → resend" branch and failed identically — a permanent signup deadlock from one
   * SMTP hiccup. With a typed code the client can say "we couldn't send the code" and offer
   * resend, which succeeds as soon as the provider recovers.
   */
  private async deliverOtpEmail(
    email: string,
    otp: string,
    locale: string,
  ): Promise<void> {
    try {
      await this.mailService.sendOtpEmail(email, otp, locale);
    } catch (e) {
      // Log enough to diagnose an outage, and nothing more. The full address is user PII, and a
      // mail-provider error message carries connection/credential detail (nodemailer's is
      // literally "Invalid login: 535-5.7.8 Username and Password not accepted"). Keep the
      // recipient's DOMAIN — "every @acme.com send is failing" is the diagnosis, the local part
      // never is — plus the provider's own error code, which is a stable non-sensitive symbol
      // (EAUTH / ECONNECTION / EENVELOPE) and more actionable than the prose anyway.
      const domain = email.slice(email.lastIndexOf('@'));
      const err = e as { code?: string; responseCode?: number } | undefined;
      const symptom =
        err?.code ?? (e instanceof Error ? e.name : typeof e);
      this.logger.error(
        `${AuthCode.OTP_SEND_FAILED}: recipient=***${domain} symptom=${symptom}` +
          (err?.responseCode ? ` smtpStatus=${err.responseCode}` : ''),
      );
      throw new ServiceUnavailableException({ code: AuthCode.OTP_SEND_FAILED });
    }
  }

  async resendOtp(email: string, locale: string = 'en') {
    // ── Per-email rate limit (shared window with forgotPassword) ──
    await this.enforceForgotOtpRateLimit(email);

    const cooldownKey = `otp_resend_cooldown:${email}`;
    const cooldownTTL = Number(
      this.configService.get('OTP_RESEND_COOLDOWN', 60),
    );

    const existing = await this.redis.get(cooldownKey);
    if (existing) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw new BadRequestException({ code: AuthCode.OTP_RESEND_COOLDOWN, params: { ttl } });
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });
    this.assertNotBlocked(user);

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.usersService.updateOtp(user._id, this.hashOtp(otp), expires);
    await this.deliverOtpEmail(email, otp, locale);

    // Reset attempt counter khi gửi lại OTP mới
    await this.redis.del(`otp_attempts:${email}`);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTTL);

    return { success: true, code: AuthCode.OTP_RESENT };
  }
}
