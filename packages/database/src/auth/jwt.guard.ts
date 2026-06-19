import { Injectable } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUser } from './jwt-user.interface';

/**
 * Shared passport-jwt strategy used by every NestJS service EXCEPT auth-service
 * (which owns session state). It verifies a Bearer access token with the same
 * symmetric secret + algorithm (HS256) the auth-service signs with, and attaches
 * the decoded {@link JwtUser} to `req.user`.
 *
 * IMPORTANT: this strategy intentionally does NOT perform the Redis session
 * revocation check — that is auth-service's concern. Downstream services trust a
 * validly-signed, unexpired token. Register this in a service's module providers
 * alongside `PassportModule`.
 */
@Injectable()
export class SharedJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      // HS256 — same as auth-service @nestjs/jwt default signing.
      algorithms: ['HS256'],
    });
  }

  // passport-jwt has already verified signature + expiry; just shape the payload.
  validate(payload: JwtUser): JwtUser {
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
}

/**
 * Drop-in `@UseGuards(JwtAuthGuard)` for protected routes. 401s on a missing or
 * invalid/expired token; on success populates `req.user` with a {@link JwtUser}.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
