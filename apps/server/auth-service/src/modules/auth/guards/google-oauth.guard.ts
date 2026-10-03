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
 *
 * Invite accept: `?flow=<flowId>` (a short-lived single-use Redis key, never the
 * raw invitation token) is appended as `state = "<platform>.<flowId>"`.
 */
const FLOW_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const platform =
      req.query?.platform || req.cookies?.['oauth_platform'] || 'mobile';
    const flow = req.query?.flow;
    const validFlow = typeof flow === 'string' && FLOW_ID_RE.test(flow);
    return {
      state: validFlow ? `${platform}.${flow}` : String(platform),
      // Always show Google's account chooser (with "Use another account"):
      // a device can be signed in to several Google accounts, and without it
      // Google silently reuses the last one — the user could never pick the
      // account PON actually knows.
      prompt: 'select_account',
    };
  }
}
