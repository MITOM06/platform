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
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../Email/mail.service';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';
import { Response } from 'express';

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

  // ===================== SOCIAL LOGIN =====================
  async handleSocialLogin(
    user: any,
    res: Response,
    provider: string,
    platform: string = 'mobile',
  ) {
    const userId = await this.ensureUserIdFromSocial(user, provider);
    const code = await this.createLoginCode(userId);

    const mobileRedirect =
      this.configService.get<string>('MOBILE_DEEPLINK_URL') ||
      'platform://auth';
    const webRedirect =
      this.configService.get<string>('WEB_REDIRECT_URL') ||
      'http://localhost:8081';
    const redirectUrl = platform === 'web' ? webRedirect : mobileRedirect;

    return res.redirect(`${redirectUrl}?code=${code}`);
  }

  async ensureUserIdFromSocial(
    profile: any,
    provider: string,
  ): Promise<string> {
    if (!profile?.email) {
      throw new UnauthorizedException(
        'Không thể lấy email từ tài khoản mạng xã hội.',
      );
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
      throw new UnauthorizedException(
        `Tài khoản bị tạm khóa ${minutes} phút do nhập sai quá nhiều lần.`,
      );
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
      throw new UnauthorizedException(
        `Bạn đã nhập sai ${maxAttempts} lần. Vui lòng thử lại sau ${Math.ceil(lockoutDuration / 60)} phút.`,
      );
    }

    const remaining = maxAttempts - attempts;
    throw new UnauthorizedException(
      `Email hoặc mật khẩu không chính xác. Còn ${remaining} lần thử.`,
    );
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
      message: 'Đăng nhập thành công',
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
      message: 'Đăng xuất thành công',
    };
  }

  // ===================== FORGOT / RESET PASSWORD =====================
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Email không tồn tại trên hệ thống');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(email, otp);
    return { success: true, message: 'OTP đã được gửi' };
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
      throw new BadRequestException(
        'Nhập sai quá nhiều lần. Vui lòng yêu cầu gửi lại OTP.',
      );
    }

    const user = await this.usersService.findByEmail(email);

    if (!user || !user.otpCode) {
      throw new BadRequestException('Mã xác thực không hợp lệ');
    }

    if (new Date() > user.otpExpires) {
      throw new BadRequestException('Mã xác thực đã hết hạn');
    }

    if (user.otpCode !== otp) {
      const remaining = maxAttempts - attempts;
      throw new BadRequestException(
        `Mã xác thực không đúng. Còn ${remaining} lần thử`,
      );
    }

    // ✅ OTP đúng → reset counter + mark verified
    await this.redis.del(attemptKey);
    await this.usersService.setVerified(user._id.toString());
    return { success: true, message: 'Mã xác thực hợp lệ' };
  }

  async resetPassword(email: string, otp: string, newPass: string) {
    // ✅ Verify OTP trước
    await this.verifyOtp(email, otp);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User không tìm thấy');

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(newPass, salt);

    // ✅ Update password và xóa OTP
    await this.usersService.updatePassword(user._id.toString(), hashedPass);

    // ✅ IMPROVEMENT: Revoke tất cả sessions cũ khi đổi mật khẩu
    await this.session.revokeAllSessions(user._id.toString());

    return {
      success: true,
      message: 'Mật khẩu đã được cập nhật thành công. Vui lòng đăng nhập lại.',
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
      throw new UnauthorizedException(
        'Mã xác nhận không hợp lệ hoặc đã hết hạn',
      );
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
        throw new BadRequestException('Email domain does not exist');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Email domain does not exist');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ConflictException('Email này đã được sử dụng');
      }
      // Tài khoản tồn tại nhưng chưa verify → gửi lại OTP thay vì báo lỗi
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      await this.usersService.updateOtp(existingUser._id, otp, expires);
      await this.mailService.sendOtpEmail(dto.email, otp);
      return {
        message:
          'Tài khoản chưa xác thực. Mã OTP mới đã gửi tới email của bạn.',
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(dto.email, otp);

    return {
      message: 'Đăng ký thành công. Mã OTP đã gửi tới email của bạn.',
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
      throw new BadRequestException(
        `Vui lòng đợi ${ttl} giây trước khi gửi lại.`,
      );
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Email không tồn tại trên hệ thống');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await this.usersService.updateOtp(user._id, otp, expires);
    await this.mailService.sendOtpEmail(email, otp);

    // Reset attempt counter khi gửi lại OTP mới
    await this.redis.del(`otp_attempts:${email}`);
    await this.redis.set(cooldownKey, '1', 'EX', cooldownTTL);

    return { success: true, message: 'Mã OTP mới đã được gửi.' };
  }
}
