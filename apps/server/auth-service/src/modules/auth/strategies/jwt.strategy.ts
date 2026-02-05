import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@platform/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      // ✅ CRITICAL: Pass request vào validate() để check session
      passReqToCallback: true,
    });
  }

  // ✅ FIX: Validate JWT + check session có bị revoke không
  async validate(req: any, payload: any) {
    // payload = { sub: userId, sid: sessionId, iat, exp }
    
    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    // Check session có tồn tại và còn active không
    const sessionKey = `sess:${payload.sid}`;
    const sessionData = await this.redis.hgetall(sessionKey);

    // ✅ FIX: Kiểm tra sessionData có tồn tại không
    if (!sessionData || Object.keys(sessionData).length === 0 || !sessionData.userId) {
      throw new UnauthorizedException('Phiên đăng nhập không tồn tại hoặc đã hết hạn');
    }

    if (sessionData.revoked === '1') {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    }

    // Verify userId trong token khớp với userId trong session
    if (sessionData.userId !== payload.sub) {
      throw new UnauthorizedException('Token không khớp với phiên đăng nhập');
    }

    // ✅ Update lastSeenAt (optional - để track user activity)
    await this.redis.hset(sessionKey, 'lastSeenAt', Date.now().toString());

    return payload; // { sub, sid, iat, exp }
  }
}