import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuthRedirectService } from '../oauth-redirect.service';
import { parseGoogleCallbackState } from './google-oauth.guard';

/**
 * The Google callback is a browser navigation, so it must never answer JSON.
 * Its handler already redirects its own failures, but GoogleOAuthGuard runs
 * first — a cancelled sign-in or a refused code used to surface as a raw
 * `{"statusCode":401}` / `{"statusCode":500}` page. This filter turns any
 * exception on that route into the usual `?error=<AuthCode>` redirect
 * (web → WEB_REDIRECT_URL, mobile → deep-link bridge page).
 */
@Catch()
@Injectable()
export class OAuthCallbackErrorFilter implements ExceptionFilter {
  constructor(private readonly oauthRedirect: OAuthRedirectService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (res.headersSent) return;
    res.clearCookie('oauth_platform');
    const { platform } = parseGoogleCallbackState(req);
    return this.oauthRedirect.redirectWithError(res, platform, exception);
  }
}
