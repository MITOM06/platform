import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthCode } from '../../../common/auth-code.enum';

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

/**
 * Platform + invite flow of a Google callback: from the echoed `state`
 * ("<platform>" or "<platform>.<flowId>"), falling back to the cookie for
 * backwards compatibility / older links.
 */
export function parseGoogleCallbackState(req: {
  query?: Record<string, unknown>;
  cookies?: Record<string, string>;
}): { platform: string; flowId?: string } {
  const state = typeof req.query?.state === 'string' ? req.query.state : '';
  const [statePlatform, flowId] = state.split('.', 2);
  const platform = statePlatform || req.cookies?.['oauth_platform'] || 'mobile';
  return { platform, flowId: flowId || undefined };
}

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleOAuthGuard.name);

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

  /**
   * Google came back without a user: the person cancelled on Google's page
   * (`?error=access_denied`) or Google refused the code (expired / already
   * used → TokenError). A typed code, so the callback's error filter redirects
   * with `?error=` instead of the browser showing a raw 401 / 500 JSON body.
   */
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (!err && user) return user;
    const req = context.switchToHttp().getRequest();
    if (req.query?.error === 'access_denied') {
      throw new UnauthorizedException({
        code: AuthCode.SOCIAL_LOGIN_CANCELLED,
      });
    }
    this.logger.warn(
      `Google sign-in failed: ${err instanceof Error ? err.message : 'no user'}`,
    );
    throw new UnauthorizedException({ code: AuthCode.SOCIAL_LOGIN_FAILED });
  }
}
