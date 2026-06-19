import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as dns from 'node:dns';
import { randomInt } from 'node:crypto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { SessionService } from './session.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../Email/mail.service';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';
import { Response } from 'express';
import { AuthCode } from '../../common/auth-code.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly mailService: MailService,
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Cryptographically secure 6-digit OTP (100000–999999).
  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  // ===================== SOCIAL LOGIN =====================
  async handleSocialLogin(
    user: any,
    res: Response,
    provider: string,
    platform: string = 'mobile',
  ) {
    const userId = await this.ensureUserIdFromSocial(user, provider);
    const code = await this.createLoginCode(userId);

    const webRedirect =
      this.configService.get<string>('WEB_REDIRECT_URL') ||
      'http://localhost:8081';

    if (platform === 'web') {
      return res.redirect(`${webRedirect}?code=${code}`);
    }

    // Mobile deep-link:
    // - iOS Safari: platform://auth?code=xxx  (CFBundleURLSchemes handles it fine)
    // - Android Chrome: intent:// URI — Chrome converts to Android Intent directly,
    //   bypassing the custom-scheme block that affects platform:// redirects.
    const encodedCode = encodeURIComponent(code);
    const iosDeeplink = `platform://auth?code=${encodedCode}`;
    // intent://auth?code=xxx#Intent;scheme=platform;package=<id>;end
    const androidIntent = `intent://auth?code=${encodedCode}#Intent;scheme=platform;package=com.platform.platform_client;S.browser_fallback_url=https%3A%2F%2Fplatform-web-omega-amber.vercel.app%2Flogin;end`;

    return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Đang chuyển về ứng dụng...</title>
  <style>
    body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
         justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#fff}
    a{display:inline-block;margin-top:16px;padding:12px 24px;background:#00e5ff;
      color:#000;border-radius:8px;text-decoration:none;font-weight:600}
    p{color:#aaa;font-size:14px}
  </style>
</head>
<body>
  <p>Đang chuyển về ứng dụng PON...</p>
  <a id="btn" href="${iosDeeplink}">Mở ứng dụng</a>
  <p id="msg" style="display:none">Không tự động mở? Nhấn nút bên trên.</p>
  <script>
    var ua = navigator.userAgent;
    var isAndroid = /Android/.test(ua);
    var deeplink = isAndroid ? ${JSON.stringify(androidIntent)} : ${JSON.stringify(iosDeeplink)};
    document.getElementById('btn').href = deeplink;
    // Auto-redirect after small delay (counts as page navigation)
    setTimeout(function() {
      window.location.replace(deeplink);
      // Show fallback button if app didn't open within 2s
      setTimeout(function() {
        document.getElementById('msg').style.display = 'block';
      }, 2000);
    }, 300);
  </script>
</body>
</html>`);
  }

  async ensureUserIdFromSocial(
    profile: any,
    provider: string,
  ): Promise<string> {
    if (!profile?.email) {
      throw new UnauthorizedException({ code: AuthCode.SOCIAL_EMAIL_UNAVAILABLE });
    }

    // 1. Tìm theo socialId trước
    let user = await this.usersService.findBySocialId(provider, profile.id);

    // 2. Nếu không tìm được theo socialId, thử tìm theo email
    if (!user) {
      user = await this.usersService.findByEmail(profile.email);
    }

    // 3. Nếu vẫn không có → tạo user mới
    if (!user) {
      const fallbackName = profile.email.split('@')[0];
      user = await this.usersService.create({
        displayName: profile.displayName || profile.name || fallbackName,
        email: profile.email,
        avatarUrl:
          profile.avatar || profile.picture || profile.photos?.[0]?.value || '',
        isVerified: true,
        socialLinks: { [provider]: profile.id },
      });
    } else if (!user.socialLinks?.[provider]) {
      // 4. User đã có nhưng chưa link provider này
      await this.usersService.updateSocialId(
        user._id.toString(),
        provider,
        profile.id,
      );
    }

    return user._id.toString();
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
  async login(dto: LoginDto) {
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

    const { sid, refreshToken } = await this.session.createSession({
      userId: user._id.toString(),
      deviceId: 'web-login',
      platform: 'web',
    });

    const accessToken = this.signAccessToken({ sub: user._id.toString(), sid });
    await this.redis.del(`failed_attempts:${dto.email}`);

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
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(email, otp);
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

    if (user.otpCode !== otp) {
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
  signAccessToken(payload: { sub: string; sid: string }) {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    // Fall back to 15m so a missing JWT_ACCESS_EXPIRES env never breaks token signing
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m';
    const options: JwtSignOptions = { secret, expiresIn: expiresIn as any };
    return this.jwt.sign(payload, options);
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

    const accessToken = this.signAccessToken({ sub: userId, sid });

    // ✅ IMPROVEMENT: Trả về thông tin user
    const user = await this.usersService.findById(userId);

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
    const accessToken = this.signAccessToken({ sub: userId, sid });
    return { accessToken, refreshToken: newRefreshToken };
  }

  // ===================== REGISTER =====================
  async register(dto: RegisterDto) {
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
      const otp = this.generateOtp();
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      await this.usersService.updateOtp(existingUser._id, otp, expires);
      await this.mailService.sendOtpEmail(dto.email, otp);
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

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(dto.email, otp);

    return {
      code: AuthCode.REGISTER_SUCCESS,
      userId: user._id,
    };
  }

  async resendOtp(email: string) {
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

    const otp = this.generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(email, otp);

    // Reset attempt counter khi gửi lại OTP mới
    await this.redis.del(`otp_attempts:${email}`);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTTL);

    return { success: true, code: AuthCode.OTP_RESENT };
  }
}
