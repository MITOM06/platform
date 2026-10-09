import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { MailService } from '../Email/mail.service';
import { SsoPolicyService } from '../sso/sso-policy.service';
import { UsersService } from '../users/users.service';
import { assertCanSignIn } from './account-status';
import { SessionService } from './session.service';

const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Email OTPs: forgot / reset password, resend, verify, and the OTP mailed when
 * an unverified account signs in. Members covered by "Require SSO" are refused
 * (403 SSO_REQUIRED) before any OTP is mailed or any password is written.
 */
@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly session: SessionService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly ssoPolicy: SsoPolicyService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Correct credentials but the email was never confirmed (legacy accounts):
   * mail a fresh OTP and steer the client to /verify-otp, never a session.
   * The per-email OTP rate limit (shared with forgot/resend) keeps this from
   * being an email-spam vector.
   */
  async rejectUnverifiedLogin(
    user: { _id: unknown; email: string },
    locale: string,
  ): Promise<never> {
    await this.enforceOtpRateLimit(user.email);
    await this.issueOtp(user._id, user.email, locale);
    throw new UnauthorizedException({
      code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
      params: { email: user.email },
    });
  }

  async forgotPassword(email: string, locale: string = 'en') {
    // ── Per-email rate limit: max 3 OTP sends per 10 minutes ──
    await this.enforceOtpRateLimit(email);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });
    await this.ssoPolicy.assertNotEnforced(user);
    this.assertNotBlocked(user);

    await this.issueOtp(user._id, email, locale);
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

    if (user.otpCode !== hashOtp(otp)) {
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
    // Require SSO: refused before the OTP is checked (no attempt is used up).
    const user = await this.usersService.findByEmail(email);
    await this.ssoPolicy.assertNotEnforced(user);
    await this.verifyOtp(email, otp);
    if (!user) throw new NotFoundException({ code: AuthCode.USER_NOT_FOUND });

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(newPass, salt);

    // Also clears the OTP and the Google-invite `mustSetPassword` flag.
    await this.usersService.updatePassword(user._id.toString(), hashedPass);
    await this.session.revokeAllSessions(user._id.toString(), 'password_reset');

    return {
      success: true,
      code: AuthCode.PASSWORD_UPDATED,
    };
  }

  async resendOtp(email: string, locale: string = 'en') {
    // ── Per-email rate limit (shared window with forgotPassword) ──
    await this.enforceOtpRateLimit(email);

    const cooldownKey = `otp_resend_cooldown:${email}`;
    const cooldownTTL = Number(
      this.configService.get('OTP_RESEND_COOLDOWN', 60),
    );

    const existing = await this.redis.get(cooldownKey);
    if (existing) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw new BadRequestException({
        code: AuthCode.OTP_RESEND_COOLDOWN,
        params: { ttl },
      });
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });
    await this.ssoPolicy.assertNotEnforced(user);
    this.assertNotBlocked(user);

    await this.issueOtp(user._id, email, locale);

    // Reset attempt counter khi gửi lại OTP mới
    await this.redis.del(`otp_attempts:${email}`);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTTL);

    return { success: true, code: AuthCode.OTP_RESENT };
  }

  // ===================== INTERNALS =====================

  /**
   * Per-email OTP send rate limit: max 3 sends per 10-minute window.
   * Shared key across forgotPassword + resendOtp + unverified login so the
   * total OTP emails to a given address count toward one window. Guards
   * against multi-IP spam that the global IP throttler misses.
   */
  private async enforceOtpRateLimit(email: string): Promise<void> {
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

  /** Stores a fresh hashed OTP (5 min) and mails it. */
  private async issueOtp(
    userId: unknown,
    email: string,
    locale: string,
  ): Promise<void> {
    const otp = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + OTP_TTL_MS);
    await this.usersService.updateOtp(userId, hashOtp(otp), expires);
    await this.deliverOtpEmail(email, otp, locale);
  }

  /**
   * Send an OTP email; a mail-provider failure becomes a typed 503 OTP_SEND_FAILED, not a 500.
   * The account row already exists here: a raw 500 left an account that could not be verified
   * and whose "unverified → resend" retry failed identically. With the typed code the client
   * offers resend, which succeeds as soon as the provider recovers.
   */
  private async deliverOtpEmail(
    email: string,
    otp: string,
    locale: string,
  ): Promise<void> {
    try {
      await this.mailService.sendOtpEmail(email, otp, locale);
    } catch (e) {
      // Log only the recipient's DOMAIN and the provider's error code (EAUTH / ECONNECTION /
      // EENVELOPE): the full address is PII, and provider messages carry credential detail.
      const domain = email.slice(email.lastIndexOf('@'));
      const err = e as { code?: string; responseCode?: number } | undefined;
      const symptom = err?.code ?? (e instanceof Error ? e.name : typeof e);
      this.logger.error(
        `${AuthCode.OTP_SEND_FAILED}: recipient=***${domain} symptom=${symptom}` +
          (err?.responseCode ? ` smtpStatus=${err.responseCode}` : ''),
      );
      throw new ServiceUnavailableException({ code: AuthCode.OTP_SEND_FAILED });
    }
  }
}

/**
 * One-way hash of an OTP before it is persisted. SHA-256 (not bcrypt) is the
 * right tool here: OTPs are short-lived (5 min) and brute-force is already
 * rate-limited at the verify layer, so we only need to ensure a DB dump can't
 * reveal live OTPs. Compare hash-to-hash; never store or match the raw code.
 */
function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}
