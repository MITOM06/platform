import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';

/** Client-side fallback code for anything that is not a known AuthCode. */
export const GENERIC_ERROR_CODE = 'GENERIC_ERROR';

const KNOWN_CODES = new Set<string>(Object.values(AuthCode));
const LOGIN_CODE_TTL_S = 300;

/** Redis key holding the grant of a one-time login code (read by AuthService.exchangeLoginCode). */
export const loginCodeKey = (code: string) => `login_code:${code}`;

/** How the user signed in. OIDC SSO is exempt from PON 2FA (the IdP owns MFA). */
export type LoginCodeVia = 'google' | 'oidc';

export interface LoginCodeGrant {
  userId: string;
  /** Undefined for a code minted before 2FA shipped: treated like Google (2FA applies). */
  via?: LoginCodeVia;
}

/** Decodes a stored login-code value: `{"userId","via"}` JSON, or a legacy bare userId. */
export function parseLoginCode(
  raw: string | null | undefined,
): LoginCodeGrant | null {
  if (!raw) return null;
  if (!raw.startsWith('{')) return { userId: raw };
  try {
    const v = JSON.parse(raw) as { userId?: unknown; via?: unknown };
    if (typeof v.userId !== 'string' || !v.userId) return null;
    return {
      userId: v.userId,
      via: v.via === 'oidc' || v.via === 'google' ? v.via : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Browser-redirect side of OAuth/SSO flows. These endpoints are navigated to by
 * the browser, so they must NEVER answer with JSON: success redirects with a
 * one-time `?code=`, failure with `?error=<AuthCode>` (web → WEB_REDIRECT_URL,
 * mobile → deep-link bridge page).
 */
@Injectable()
export class OAuthRedirectService {
  private readonly logger = new Logger(OAuthRedirectService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createLoginCode(
    userId: string,
    via: LoginCodeVia = 'google',
  ): Promise<string> {
    const code = nanoid(32);
    const grant: LoginCodeGrant = { userId, via };
    await this.redis.set(
      loginCodeKey(code),
      JSON.stringify(grant),
      'EX',
      LOGIN_CODE_TTL_S,
    );
    return code;
  }

  /** Mints a one-time login code for a resolved user and redirects back to the client. */
  async redirectWithLoginCode(
    userId: string,
    res: Response,
    platform: string,
    via: LoginCodeVia = 'google',
  ) {
    const code = await this.createLoginCode(userId, via);
    return this.redirectToClient(res, platform, { code });
  }

  /** Redirects with `?error=<AuthCode>`; unknown / 5xx / non-HTTP errors → GENERIC_ERROR. */
  redirectWithError(res: Response, platform: string, err: unknown) {
    return this.redirectToClient(res, platform, {
      error: this.toErrorCode(err),
    });
  }

  toErrorCode(err: unknown): string {
    if (err instanceof HttpException && err.getStatus() < 500) {
      const body = err.getResponse();
      const code =
        body && typeof body === 'object'
          ? (body as { code?: unknown }).code
          : undefined;
      if (typeof code === 'string' && KNOWN_CODES.has(code)) return code;
      return GENERIC_ERROR_CODE;
    }
    this.logger.error(
      `OAuth redirect flow failed: ${err instanceof Error ? err.name : typeof err}`,
    );
    return GENERIC_ERROR_CODE;
  }

  redirectToClient(
    res: Response,
    platform: string,
    payload: { code: string } | { error: string },
  ) {
    const [param, value] =
      'code' in payload ? ['code', payload.code] : ['error', payload.error];
    const encoded = encodeURIComponent(value);

    // Production is guaranteed to have this (main.ts refuses to boot without it),
    // so the fallback is purely the local web dev server.
    const webRedirect =
      this.configService.get<string>('WEB_REDIRECT_URL') ||
      'http://localhost:3000/oauth-callback';

    if (platform === 'web') {
      return res.redirect(`${webRedirect}?${param}=${encoded}`);
    }

    // Mobile deep-link:
    // - iOS Safari: platform://auth?code=xxx  (CFBundleURLSchemes handles it fine)
    // - Android Chrome: intent:// URI — Chrome converts to Android Intent directly,
    //   bypassing the custom-scheme block that affects platform:// redirects.
    const iosDeeplink = `platform://auth?${param}=${encoded}`;
    // Derive the browser fallback from WEB_REDIRECT_URL rather than hardcoding the
    // production web host: a local build used to fall back to the live site.
    const browserFallback = encodeURIComponent(
      new URL('/login', webRedirect).toString(),
    );
    const androidIntent = `intent://auth?${param}=${encoded}#Intent;scheme=platform;package=com.platform.platform_client;S.browser_fallback_url=${browserFallback};end`;

    return res.send(bridgeHtml(iosDeeplink, androidIntent));
  }
}

function bridgeHtml(iosDeeplink: string, androidIntent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Đang chuyển về ứng dụng...</title>
  <style>
    /* Warm Grey & Burgundy palette (docs/superpowers/UI-REDESIGN-DIRECTION.md §2).
       This page is served by auth-service, so it is outside both apps' theming
       and kept the old neon brand until the redesign's final pass. */
    body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
         justify-content:center;height:100vh;margin:0;background:#1A1614;color:#F3EEE8}
    a{display:inline-block;margin-top:16px;padding:12px 24px;background:#96435B;
      color:#fff;border-radius:10px;text-decoration:none;font-weight:600}
    p{color:#B0A79C;font-size:14px}
  </style>
</head>
<body>
  <p>Đang chuyển về ứng dụng PON...</p>
  <a id="btn" href="${iosDeeplink}">Mở ứng dụng</a>
  <p id="msg" style="display:none">Không tự động mở? Nhấn nút bên trên.</p>
  <script>
    var ua = navigator.userAgent;
    var isAndroid = /Android/.test(ua);
    var deeplink = isAndroid ? ${JSON.stringify(androidIntent)} : ${JSON.stringify(iosDeeplink)};
    document.getElementById('btn').href = deeplink;
    // Auto-redirect after small delay (counts as page navigation)
    setTimeout(function() {
      window.location.replace(deeplink);
      // Show fallback button if app didn't open within 2s
      setTimeout(function() {
        document.getElementById('msg').style.display = 'block';
      }, 2000);
    }, 300);
  </script>
</body>
</html>`;
}
