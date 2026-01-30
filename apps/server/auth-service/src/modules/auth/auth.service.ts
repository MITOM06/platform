import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { SessionService } from './session.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  mailService: any;
  constructor(
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }



  async ensureUserIdFromSocial(profile: any, provider: string): Promise<string> {
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      user = await this.usersService.create({
        displayName: profile.displayName || profile.name || profile.username,
        email: profile.email,
        avatar: profile.avatar || profile.picture || profile.photos?.[0]?.value,
        isVerified: true,
      });
    }
    return user._id.toString();
  }

  async checkBruteForce(email: string) {
    const lockoutKey = `lockout:${email}`;
    const isLocked = await this.redis.get(lockoutKey);

    if (isLocked) {
      throw new UnauthorizedException('Tài khoản bị tạm khóa 5 phút do nhập sai quá nhiều lần.');
    }
  }

  async handleFailedLogin(email: string) {
    const attemptKey = `failed_attempts:${email}`;
    const attempts = await this.redis.incr(attemptKey);

    if (attempts === 1) {
      await this.redis.expire(attemptKey, 600); // Reset bộ đếm sau 10 phút nếu không sai thêm
    }

    if (attempts >= 5) {
      await this.redis.set(`lockout:${email}`, '1', 'EX', 300); // Khóa 300s (5 phút)
      await this.redis.del(attemptKey); // Xóa bộ đếm
      throw new UnauthorizedException('Bạn đã nhập sai 5 lần. Vui lòng thử lại sau 5 phút.');
    }
  }

  async login(dto: LoginDto) {
    await this.checkBruteForce(dto.email);

    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isMatch = user ? await bcrypt.compare(dto.password, user.password) : false;

    if (!user || !isMatch) {
      await this.handleFailedLogin(dto.email);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
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
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  async forgotPassword(email: string) {

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.mailService.sendOtpEmail(email, otp);

    return { message: 'OTP đã được gửi về Email của bạn' };
  }

  signAccessToken(payload: { sub: string; sid: string }) {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES');

    const options: JwtSignOptions = {
      secret,
      expiresIn: expiresIn as any,
    };

    return this.jwt.sign(payload, options);
  }


  async createLoginCode(userId: string) {
    const code = nanoid(32);
    const key = `login_code:${code}`;
    await this.redis.set(key, userId, 'EX', 300);
    return code;
  }


  async exchangeLoginCode(code: string, deviceId?: string, platform?: string) {
    const key = `login_code:${code}`;
    const userId = await this.redis.get(key);

    if (!userId) {
      throw new UnauthorizedException('Mã xác nhận không hợp lệ hoặc đã hết hạn');
    }

    await this.redis.del(key);

    const { sid, refreshToken } = await this.session.createSession({
      userId,
      deviceId: deviceId || 'unknown',
      platform: platform || 'web'
    });

    const accessToken = this.signAccessToken({ sub: userId, sid });

    return { userId, sid, accessToken, refreshToken };
  }

  async refresh(sid: string, refreshToken: string) {
    const { userId, newRefreshToken } = await this.session.rotateRefreshToken({
      sid,
      refreshToken
    });

    const accessToken = this.signAccessToken({ sub: userId, sid });
    return { accessToken, refreshToken: newRefreshToken };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await this.usersService.create({
      displayName: dto.displayName,
      email: dto.email,
      password: hashedPassword,
      isVerified: false,
    });

    return {
      message: 'Đăng ký tài khoản thành công',
      userId: user._id,
    };
  }

}