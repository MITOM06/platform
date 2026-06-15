import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Google OAuth guard that carries the originating `platform` (web | mobile)
 * through the OAuth `state` parameter.
 *
 * Why: Google echoes `state` back to the callback verbatim, so it survives the
 * cross-site redirect with no expiry — unlike a cookie, which can be dropped by
 * SameSite rules or expire while the user sits on the consent screen. Google's
 * strategy here does NOT enable `state: true`, so `state` is free for our use
 * (passport's NullStore performs no CSRF validation on it).
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const platform =
      req.query?.platform || req.cookies?.['oauth_platform'] || 'mobile';
    return { state: String(platform) };
  }
}
