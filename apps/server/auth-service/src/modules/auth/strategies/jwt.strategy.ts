import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { Request } from 'express';
import { AuthCode } from '../../../common/auth-code.enum';

export interface JwtPayload {
  sub: string;   // userId
  sid: string;   // sessionId
  // RBAC claims — optional for backward-compat with in-flight tokens issued
  // before the enterprise foundation. Services read these to enforce statelessly.
  role?: string;          // role name (e.g. 'Owner' | 'Admin' | ...)
  perms?: string[];       // enabled capability keys (see Capability)
  depts?: string[];       // department ids the user belongs to
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
  async validate(req: Request, payload: JwtPayload) {
    // payload = { sub: userId, sid: sessionId, iat, exp }

    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException({ code: AuthCode.TOKEN_INVALID });
    }

    // Check session exists and is still active
    const sessionKey = `sess:${payload.sid}`;
    const sessionData = await this.redis.hgetall(sessionKey);

    if (
      !sessionData ||
      Object.keys(sessionData).length === 0 ||
      !sessionData.userId
    ) {
      throw new UnauthorizedException({ code: AuthCode.SESSION_NOT_FOUND });
    }

    if (sessionData.revoked === '1') {
      throw new UnauthorizedException({ code: AuthCode.SESSION_REVOKED });
    }

    // Verify userId in token matches userId in session
    if (sessionData.userId !== payload.sub) {
      throw new UnauthorizedException({ code: AuthCode.TOKEN_SESSION_MISMATCH });
    }

    // ✅ Update lastSeenAt (optional - để track user activity).
    // Throttle: only write if >60s since the last write, to cut Redis write
    // amplification on every authenticated request.
    const now = Date.now();
    const lastSeenAt = Number(sessionData.lastSeenAt) || 0;
    if (now - lastSeenAt > 60_000) {
      await this.redis.hset(sessionKey, 'lastSeenAt', now.toString());
    }

    return payload; // { sub, sid, iat, exp }
  }
}
