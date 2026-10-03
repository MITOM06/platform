import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as dns from 'node:dns';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';
import { AuthCode } from '../../common/auth-code.enum';
import { OtpService } from './otp.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly claims: ClaimsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly otp: OtpService,
    private readonly notificationsService: NotificationsService,
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

  // ===================== BRUTE FORCE =====================
  async checkBruteForce(email: string) {
    const lockoutKey = `lockout:${email}`;
    const isLocked = await this.redis.get(lockoutKey);

    if (isLocked) {
      const ttl = await this.redis.ttl(lockoutKey);
      const minutes = Math.ceil(ttl / 60);
      throw new UnauthorizedException({ code: AuthCode.ACCOUNT_LOCKED, params: { minutes } });
    }
  }

  async handleFailedLogin(email: string): Promise<never> {
    const maxAttempts = Number(
      this.configService.get('MAX_FAILED_ATTEMPTS', 5),
    );
    const attemptsTTL = Number(
      this.configService.get('FAILED_LOGIN_ATTEMPTS_TTL', 600),
    );
    const lockoutDuration = Number(
      this.configService.get('LOCKOUT_DURATION', 300),
    );

    const attemptKey = `failed_attempts:${email}`;
    const attempts = await this.redis.incr(attemptKey);

    if (attempts === 1) {
      await this.redis.expire(attemptKey, attemptsTTL);
    }

    if (attempts >= maxAttempts) {
      await this.redis.set(`lockout:${email}`, '1', 'EX', lockoutDuration);
      await this.redis.del(attemptKey);
      throw new UnauthorizedException({
        code: AuthCode.LOGIN_FAILED_LOCKED,
        params: { maxAttempts, minutes: Math.ceil(lockoutDuration / 60) },
      });
    }

    const remaining = maxAttempts - attempts;
    throw new UnauthorizedException({
      code: AuthCode.LOGIN_FAILED_WITH_REMAINING,
      params: { remaining },
    });
  }

  // ===================== LOGIN / LOGOUT =====================
  async login(dto: LoginDto, locale: string = 'en') {
    await this.checkBruteForce(dto.email);
    const user = await this.usersService.findByEmail(dto.email);

    // ✅ FIX: Kiểm tra user và throw ngay - TypeScript hiểu user không null sau đây
    if (!user) {
      await this.handleFailedLogin(dto.email);
      // handleFailedLogin return type là 'never' → TypeScript biết code dưới không chạy
      return; // unreachable, nhưng giúp TypeScript yên tâm
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      await this.handleFailedLogin(dto.email);
      return; // unreachable
    }

    // ── SECURITY: an unverified account must never receive a session. ──
    // Credentials are correct but the email was never confirmed (user hit
    // "back" on the OTP screen and logged in). Resend a fresh OTP and steer
    // the client to /verify-otp instead of minting tokens. The per-email OTP
    // rate limit (shared with forgot/resend) keeps this from being an
    // email-spam vector even with valid credentials.
    if (!user.isVerified) {
      await this.enforceForgotOtpRateLimit(user.email);
      await this.otp.issue(user._id, user.email, locale);
      throw new UnauthorizedException({
        code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
        params: { email: user.email },
      });
    }

    const { sid, refreshToken } = await this.session.createSession({
      userId: user._id.toString(),
      deviceId: 'web-login',
      platform: 'web',
    });

    const accessToken = await this.signAccessTokenWithClaims(
      user._id.toString(),
      sid,
    );
    await this.redis.del(`failed_attempts:${dto.email}`);

    // Fire-and-forget: nudge the user to set a password / verify their phone.
    this.triggerSetupNotifications(
      user._id.toString(),
      user.phoneVerified ?? false,
    );

    return {
      code: AuthCode.LOGIN_SUCCESS,
      accessToken,
      refreshToken,
      sid,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
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

  async forgotPassword(email: string, locale: string = 'en') {
    // ── Per-email rate limit: max 3 OTP sends per 10 minutes ──
    await this.enforceForgotOtpRateLimit(email);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });

    await this.otp.issue(user._id, email, locale);
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

    if (!this.otp.matches(user.otpCode, otp)) {
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
    await this.session.revokeAllSessions(user._id.toString());

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

  async createLoginCode(userId: string) {
    const code = nanoid(32);
    await this.redis.set(`login_code:${code}`, userId, 'EX', 300);
    return code;
  }

  async exchangeLoginCode(code: string, deviceId?: string, platform?: string) {
    const key = `login_code:${code}`;
    const userId = await this.redis.get(key);

    if (!userId) {
      throw new UnauthorizedException({ code: AuthCode.LOGIN_CODE_INVALID });
    }

    await this.redis.del(key);

    const { sid, refreshToken } = await this.session.createSession({
      userId,
      deviceId: deviceId || 'unknown',
      platform: platform || 'web',
    });

    const accessToken = await this.signAccessTokenWithClaims(userId, sid);

    // ✅ IMPROVEMENT: Trả về thông tin user
    const user = await this.usersService.findById(userId);

    if (user) {
      // Fire-and-forget: nudge the user to set a password / verify their phone.
      this.triggerSetupNotifications(userId, user.phoneVerified ?? false);
    }

    return {
      userId,
      sid,
      accessToken,
      refreshToken,
      user: user
        ? {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isVerified: user.isVerified,
          }
        : null,
    };
  }

  async refresh(sid: string, refreshToken: string) {
    const { userId, newRefreshToken } = await this.session.rotateRefreshToken({
      sid,
      refreshToken,
    });
    const accessToken = await this.signAccessTokenWithClaims(userId, sid);
    return { accessToken, refreshToken: newRefreshToken };
  }

  // ===================== REGISTER =====================
  async register(dto: RegisterDto, locale: string = 'en') {
    const domain = dto.email.split('@')[1];
    try {
      const records = await dns.promises.resolveMx(domain);
      if (!records || records.length === 0) {
        throw new BadRequestException({ code: AuthCode.EMAIL_DOMAIN_INVALID });
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException({ code: AuthCode.EMAIL_DOMAIN_INVALID });
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ConflictException({ code: AuthCode.EMAIL_IN_USE });
      }
      // Account exists but unverified → resend OTP instead of erroring
      await this.otp.issue(existingUser._id, dto.email, locale);
      return {
        code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
        userId: existingUser._id,
      };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await this.usersService.create({
      displayName: dto.displayName,
      email: dto.email,
      password: hashedPassword,
      isVerified: false,
    });

    await this.otp.issue(user._id, dto.email, locale);

    return {
      code: AuthCode.REGISTER_SUCCESS,
      userId: user._id,
    };
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

    await this.otp.issue(user._id, email, locale);

    // Reset attempt counter khi gửi lại OTP mới
    await this.redis.del(`otp_attempts:${email}`);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTTL);

    return { success: true, code: AuthCode.OTP_RESENT };
  }
}
