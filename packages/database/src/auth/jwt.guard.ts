import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { JwtUser } from './jwt-user.interface';
import {
  SESSION_CLAIMS_AT_FIELD,
  TOKEN_CLAIMS_STALE,
  isTokenClaimsStale,
} from './claims-stale';

/**
 * Shared passport-jwt strategy used by every NestJS service EXCEPT auth-service
 * (which owns session state and has its own strategy). It verifies a Bearer
 * access token with the same symmetric secret + algorithm (HS256) the
 * auth-service signs with, then enforces the SAME session check as auth-service
 * (instant block — no access-token grace window):
 *
 *   `sess:{sid}` exists AND its `userId === sub` AND `revoked !== '1'`
 *   AND NOT (`claimsAt` set AND token `iat < claimsAt`)
 *
 * Failures → 401 `{ code: SESSION_NOT_FOUND | SESSION_REVOKED |
 * TOKEN_SESSION_MISMATCH | TOKEN_CLAIMS_STALE | TOKEN_INVALID }`, which the
 * clients' 401 → refresh path already handles (`TOKEN_CLAIMS_STALE` = the role /
 * departments / permissions changed after the token was minted: the session is
 * still valid, a refresh mints a token with the fresh claims — never a logout).
 * A Redis outage fails CLOSED with 503 `SESSION_CHECK_UNAVAILABLE` (not 401, so
 * a Redis blip never logs users out).
 *
 * No local cache: one HMGET per request, so a revocation (block, password
 * reset) or a claims change takes effect on the very next request.
 *
 * Requires `REDIS_CLIENT` in the DI container — import `DatabaseRedisModule`
 * (global) in the service's root module alongside `PassportModule`. It is NOT
 * marked optional on purpose: a missing Redis must fail at boot, never silently
 * skip the check.
 */
@Injectable()
export class SharedJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(SharedJwtStrategy.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      // HS256 — same as auth-service @nestjs/jwt default signing.
      algorithms: ['HS256'],
    });
  }

  // passport-jwt has already verified signature + expiry.
  async validate(payload: JwtUser): Promise<JwtUser> {
    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID' });
    }
    await this.assertSessionActive(payload.sub, payload.sid, payload.iat);
    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role,
      perms: payload.perms,
      depts: payload.depts,
      iat: payload.iat,
      exp: payload.exp,
    };
  }

  private async assertSessionActive(
    sub: string,
    sid: string,
    iat: number | undefined,
  ): Promise<void> {
    let userId: string | null;
    let revoked: string | null;
    let claimsAt: string | null;
    try {
      [userId, revoked, claimsAt] = await this.redis.hmget(
        `sess:${sid}`,
        'userId',
        'revoked',
        SESSION_CLAIMS_AT_FIELD,
      );
    } catch (err) {
      this.logger.error(`Session check failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'SESSION_CHECK_UNAVAILABLE',
      });
    }
    if (!userId) {
      throw new UnauthorizedException({ code: 'SESSION_NOT_FOUND' });
    }
    if (revoked === '1') {
      throw new UnauthorizedException({ code: 'SESSION_REVOKED' });
    }
    if (userId !== sub) {
      throw new UnauthorizedException({ code: 'TOKEN_SESSION_MISMATCH' });
    }
    if (isTokenClaimsStale(iat, claimsAt)) {
      throw new UnauthorizedException({ code: TOKEN_CLAIMS_STALE });
    }
  }
}

/**
 * Drop-in `@UseGuards(JwtAuthGuard)` for protected routes. 401s on a missing,
 * invalid/expired token or a revoked/unknown session; on success populates
 * `req.user` with a {@link JwtUser}.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
