import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { nanoid } from 'nanoid';
import { Redis } from '@platform/database';
import { SessionService } from './session.service';

type RedisClient = any;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly session: SessionService,
    @Inject(Redis) private readonly redis: RedisClient,
  ) { }

  // giả định req.user từ Google strategy đã có { providerUserId, email, name, avatar }
  // bạn sẽ map sang user nội bộ (DB) ở bước sau; tạm coi userId là email hoặc id DB
  async ensureUserIdFromGoogle(profile: any): Promise<string> {
    // TODO: thay bằng UsersService + MongoDB của bạn
    // return await this.usersService.findOrCreateFromGoogle(profile)
    return profile.email; // tạm thời
  }

  signAccessToken(payload: { sub: string; sid: string }) {
    const ttlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
    return this.jwt.sign(
      { sub: payload.sub, sid: payload.sid },
      { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: ttlSeconds },
    );
  }

  async createLoginCode(userId: string) {
    const code = nanoid(32);
    const key = `login_code:${code}`;
    await this.redis.set(key, userId, 'EX', 60); // 60s
    return code;
  }

  async exchangeLoginCode(code: string, deviceId?: string, platform?: string) {
    const key = `login_code:${code}`;
    const userId = await this.redis.get(key);
    if (!userId) throw new UnauthorizedException('Invalid or expired code');

    await this.redis.del(key);

    const { sid, refreshToken } = await this.session.createSession({ userId, deviceId, platform });
    const accessToken = this.signAccessToken({ sub: userId, sid });

    return { userId, sid, accessToken, refreshToken };
  }

  async refresh(sid: string, refreshToken: string) {
    const { userId, newRefreshToken } = await this.session.rotateRefreshToken({ sid, refreshToken });
    const accessToken = this.signAccessToken({ sub: userId, sid });
    return { accessToken, refreshToken: newRefreshToken };
  }
}
