import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { UsersService } from '../users/users.service';
import { AuthCode } from '../../common/auth-code.enum';

/**
 * Social (Google / Twitter) and OIDC SSO sign-in: resolve or create the PON user for an external
 * identity, then hand the client a one-time login code. Extracted from {@link AuthService} to keep
 * that class within the clean-code line limit; behaviour is unchanged.
 */
@Injectable()
export class SocialLoginService {
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly session: SessionService,
    private readonly ssoMapping: SsoMappingService,
  ) {}

  // ===================== SOCIAL LOGIN =====================
  async handleSocialLogin(
    user: any,
    res: Response,
    provider: string,
    platform: string = 'mobile',
  ) {
    const userId = await this.ensureUserIdFromSocial(user, provider);
    return this.redirectWithLoginCode(userId, res, platform);
  }

  // Mints a one-time login code for a resolved user and redirects (web) or
  // serves the mobile deep-link bridge. Shared by social + OIDC SSO login.
  async redirectWithLoginCode(userId: string, res: Response, platform: string) {
    const code = await this.auth.createLoginCode(userId);

    // Production is guaranteed to have this (main.ts refuses to boot without it),
    // so the fallback is purely the local web dev server.
    const webRedirect =
      this.configService.get<string>('WEB_REDIRECT_URL') ||
      'http://localhost:3000/oauth-callback';

    if (platform === 'web') {
      return res.redirect(`${webRedirect}?code=${code}`);
    }

    // Mobile deep-link:
    // - iOS Safari: platform://auth?code=xxx  (CFBundleURLSchemes handles it fine)
    // - Android Chrome: intent:// URI — Chrome converts to Android Intent directly,
    //   bypassing the custom-scheme block that affects platform:// redirects.
    const encodedCode = encodeURIComponent(code);
    const iosDeeplink = `platform://auth?code=${encodedCode}`;
    // intent://auth?code=xxx#Intent;scheme=platform;package=<id>;end
    // Derive the browser fallback from WEB_REDIRECT_URL rather than hardcoding the
    // production web host: a local build used to fall back to the live site.
    const browserFallback = encodeURIComponent(
      new URL('/login', webRedirect).toString(),
    );
    const androidIntent = `intent://auth?code=${encodedCode}#Intent;scheme=platform;package=com.platform.platform_client;S.browser_fallback_url=${browserFallback};end`;

    return res.send(`<!DOCTYPE html>
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
</html>`);
  }

  // ===================== OIDC SSO =====================
  async handleOidcLogin(
    profile: {
      email: string;
      displayName: string;
      id: string;
      groups: string[];
    },
    res: Response,
    platform: string,
  ) {
    const gate = await this.ssoMapping.getGate();
    if (!gate.enabled)
      throw new UnauthorizedException({ code: 'SSO_DISABLED' });

    // Enforce allowed email domains if configured (empty list = any domain).
    if (gate.allowedDomains.length > 0) {
      const domain = profile.email.split('@')[1]?.toLowerCase();
      const ok = gate.allowedDomains.some((d) => d.toLowerCase() === domain);
      if (!ok)
        throw new UnauthorizedException({ code: 'SSO_DOMAIN_NOT_ALLOWED' });
    }

    const userId = await this.ensureUserIdFromSocial(profile, 'oidc');
    const { changed } = await this.ssoMapping.apply(
      userId,
      profile.email,
      profile.groups,
    );
    if (changed) {
      // role/dept changed → invalidate existing sessions so new claims take effect.
      await this.session.revokeAllSessions(userId);
    }
    return this.redirectWithLoginCode(userId, res, platform);
  }

  async ensureUserIdFromSocial(
    profile: any,
    provider: string,
  ): Promise<string> {
    if (!profile?.email) {
      throw new UnauthorizedException({
        code: AuthCode.SOCIAL_EMAIL_UNAVAILABLE,
      });
    }

    // 1. Tìm theo socialId trước
    let user = await this.usersService.findBySocialId(provider, profile.id);

    // 2. Nếu không tìm được theo socialId, thử tìm theo email
    if (!user) {
      user = await this.usersService.findByEmail(profile.email);
    }

    // 3. Nếu vẫn không có → tạo user mới
    if (!user) {
      const fallbackName = profile.email.split('@')[0];
      user = await this.usersService.create({
        displayName: profile.displayName || profile.name || fallbackName,
        email: profile.email,
        avatarUrl:
          profile.avatar || profile.picture || profile.photos?.[0]?.value || '',
        isVerified: true,
        socialLinks: { [provider]: profile.id },
      });
    } else if (!user.socialLinks?.[provider]) {
      // 4. User đã có nhưng chưa link provider này
      await this.usersService.updateSocialId(
        user._id.toString(),
        provider,
        profile.id,
      );
    }

    return user._id.toString();
  }
}
