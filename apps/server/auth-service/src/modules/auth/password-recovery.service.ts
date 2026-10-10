import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { normalizeEmail } from '../../common/email';
import { SsoPolicyService } from '../sso/sso-policy.service';
import { UsersService } from '../users/users.service';
import { assertCanSignIn } from './account-status';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

/**
 * Email OTPs: forgot / reset password, resend, verify, and the OTP mailed when
 * an unverified account signs in. Members covered by "Require SSO" are refused
 * (403 SSO_REQUIRED) before any OTP is mailed or any password is written.
 * Codes are issued and checked by {@link OtpService}.
 */
@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly otp: OtpService,
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
    await this.otp.issue(user._id, user.email, locale);
    throw new UnauthorizedException({
      code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
      params: { email: user.email },
    });
  }

  async forgotPassword(rawEmail: string, locale: string = 'en') {
    const email = normalizeEmail(rawEmail);
    // ── Per-email rate limit: max 3 OTP sends per 10 minutes ──
    await this.enforceOtpRateLimit(email);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });
    await this.ssoPolicy.assertNotEnforced(user);
    this.assertNotBlocked(user);

    // Mail the address on file (legacy rows may differ in case from the input).
    await this.otp.issue(user._id, user.email, locale);
    return { success: true, code: AuthCode.OTP_SENT };
  }

  /**
   * Check an emailed OTP. Does NOT consume it: the mobile forgot-password flow
   * calls verify-otp and then reset-password with the same code. The code is
   * consumed by a successful reset (updatePassword unsets it) or expires.
   */
  async verifyOtp(rawEmail: string, otp: string) {
    const email = normalizeEmail(rawEmail);
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

    if (!this.otp.matches(user.otpCode, otp)) {
      const remaining = maxAttempts - attempts;
      throw new BadRequestException({
        code: AuthCode.OTP_WRONG_WITH_REMAINING,
        params: { remaining },
      });
    }

    // OTP correct → reset counter + mark verified (the code stays valid)
    await this.redis.del(attemptKey);
    await this.usersService.setVerified(user._id.toString());
    return { success: true, code: AuthCode.OTP_VALID };
  }

  async resetPassword(rawEmail: string, otp: string, newPass: string) {
    const email = normalizeEmail(rawEmail);
    // Require SSO: refused before the OTP is checked (no attempt is used up).
    const user = await this.usersService.findByEmail(email);
    await this.ssoPolicy.assertNotEnforced(user);
    await this.verifyOtp(email, otp);
    if (!user) throw new NotFoundException({ code: AuthCode.USER_NOT_FOUND });

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(newPass, salt);

    // Also clears the OTP (so replaying the same reset fails with OTP_INVALID)
    // and the Google-invite `mustSetPassword` flag.
    await this.usersService.updatePassword(user._id.toString(), hashedPass);
    await this.session.revokeAllSessions(user._id.toString(), 'password_reset');

    return {
      success: true,
      code: AuthCode.PASSWORD_UPDATED,
    };
  }

  async resendOtp(rawEmail: string, locale: string = 'en') {
    const email = normalizeEmail(rawEmail);
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

    await this.otp.issue(user._id, user.email, locale);

    // The wrong-guess counter (otp_attempts:<email>) is NOT reset here: it
    // keeps counting across resends until its own TTL, otherwise every resend
    // would hand out a fresh batch of guesses.
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
    const rateKey = `forgot_otp_rate:${normalizeEmail(email)}`;
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
}
