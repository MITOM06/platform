import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  Res,
  UseGuards,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AuthService } from './auth.service';
import { OidcService } from './oidc/oidc.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ExchangeDto } from './dto/exchange.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { normalizeLocale } from '../Email/otp-i18n';

// Stricter per-IP limits for credential / OTP endpoints (5 requests / minute).
// Names must match a ThrottlerModule.forRoot() definition; we override 'medium'.
const SENSITIVE_THROTTLE = { medium: { limit: 5, ttl: 60000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
    private readonly oidc: OidcService,
    private readonly ssoMapping: SsoMappingService,
  ) {}

  // ===================== SOCIAL LOGIN =====================
  // Client gọi /auth/google?platform=web hoặc ?platform=mobile
  // Google redirect về /auth/google/callback — nhưng query param 'platform' bị mất
  // Nên client cần pass platform qua 'state' param, backend save state trước khi redirect
  // Cách đơn giản hơn: save platform vào session/cookie trước khi redirect sang Google

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth flow' })
  async google() {
    // GoogleOAuthGuard reads ?platform=… and forwards it through the OAuth
    // `state` param, so the callback can recover it cookie-independently.
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback (redirects back to client)' })
  async googleCallback(@Req() req: any, @Res() res: Response) {
    // ✅ Platform travels in the OAuth `state` param (echoed back by Google).
    // Fall back to the cookie for backwards compatibility / older links.
    const platform =
      req.query?.state || req.cookies?.['oauth_platform'] || 'mobile';
    res.clearCookie('oauth_platform');
    return this.auth.handleSocialLogin(req.user, res, 'google', platform);
  }



  @Get('twitter')
  @UseGuards(AuthGuard('twitter'))
  @ApiOperation({ summary: 'Start Twitter/X OAuth flow' })
  async twitter() {}

  @Get('twitter/callback')
  @UseGuards(AuthGuard('twitter'))
  @ApiOperation({ summary: 'Twitter/X OAuth callback (redirects back to client)' })
  async twitterCallback(@Req() req: any, @Res() res: Response) {
    const platform = req.cookies?.['oauth_platform'] || 'mobile';
    res.clearCookie('oauth_platform');
    return this.auth.handleSocialLogin(req.user, res, 'twitter', platform);
  }

  // ===================== SET PLATFORM COOKIE =====================
  // Client gọi endpoint này TRƯỚC khi redirect sang OAuth
  // Endpoint này save platform vào cookie rồi redirect về /auth/{provider}
  // Cách này giải quyết vấn đề platform bị mất sau OAuth redirect
  @Get('social/:provider/init')
  @ApiOperation({
    summary: 'Persist platform then redirect into the provider OAuth flow',
  })
  async initSocialLogin(
    @Req() req: any,
    @Res() res: Response,
    @Query('platform') platform: string,
  ) {
    const provider = req.params.provider; // google | twitter
    const resolvedPlatform = platform || 'mobile';

    // Fallback cookie (primary mechanism is the OAuth `state` param via query).
    // Twitter enables `state: true` for PKCE/CSRF, so it can't overload `state`
    // and still relies on this cookie — give it room to outlive the consent
    // screen and proper SameSite/Secure so it survives the cross-site redirect.
    res.cookie('oauth_platform', resolvedPlatform, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 phút — đủ cho cả màn hình consent của Google
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    // Carry platform in the query so GoogleOAuthGuard can forward it as `state`.
    // Redirect về endpoint OAuth thật — AuthGuard sẽ kick off OAuth flow
    return res.redirect(
      `/auth/${provider}?platform=${encodeURIComponent(resolvedPlatform)}`,
    );
  }

  // ===================== OIDC SSO =====================
  @Get('oidc/login')
  @ApiOperation({ summary: 'Begin OIDC SSO (redirects to the IdP)' })
  async oidcLogin(@Query('platform') platform: string, @Res() res: Response) {
    if (!this.oidc.isEnabledByEnv()) {
      return res.status(404).send('SSO not configured');
    }
    const url = await this.oidc.buildAuthorizeUrl(platform || 'web');
    return res.redirect(url);
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'OIDC callback (redirects back to client)' })
  async oidcCallback(@Req() req: any, @Res() res: Response) {
    // handleCallback returns the chosen platform (stored in the Redis flow at /oidc/login).
    const { platform, ...profile } = await this.oidc.handleCallback(req.query);
    return this.auth.handleOidcLogin(profile, res, platform || 'web');
  }

  @Get('sso/info')
  @ApiOperation({ summary: 'Public: whether the SSO button should show' })
  async ssoInfo() {
    const gate = await this.ssoMapping.getGate();
    const enabled = this.oidc.isEnabledByEnv() && gate.enabled;
    return {
      enabled,
      loginUrl: enabled ? '/auth/oidc/login' : null,
      buttonLabel: 'Sign in with SSO',
    };
  }

  // ===================== AUTH ENDPOINTS =====================
  @Post('exchange')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Exchange a one-time login code for tokens' })
  @ApiResponse({ status: 201, description: 'Access + refresh tokens issued' })
  async exchange(@Body() body: ExchangeDto) {
    return this.auth.exchangeLoginCode(body.code, body.deviceId, body.platform);
  }

  @Post('refresh')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Rotate the access token using a refresh token' })
  @ApiResponse({ status: 201, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.sid, body.refreshToken);
  }

  @Post('register')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.auth.register(dto, normalizeLocale(acceptLang));
  }

  @Post('login')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  @ApiResponse({ status: 201, description: 'Login succeeded; tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // ✅ Logout — yêu cầu JWT token trong header
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Req() req: any, @Body() body: { sid: string }) {
    return this.auth.logout(req.user.sub, body.sid);
  }

  // ===================== FORGOT PASSWORD =====================
  @Post('forgot-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Send a password-reset OTP to the email' })
  async forgot(
    @Body() dto: ForgotPasswordDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.auth.forgotPassword(dto.email, normalizeLocale(acceptLang));
  }

  @Post('verify-otp')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Verify a password-reset OTP' })
  @ApiBody({ type: VerifyOtpDto })
  async verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @Post('resend-otp')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Resend a password-reset OTP' })
  @ApiBody({ type: ResendOtpDto })
  async resend(
    @Body() dto: ResendOtpDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.auth.resendOtp(dto.email, normalizeLocale(acceptLang));
  }

  @Post('reset-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Reset password using a verified OTP' })
  @ApiBody({ type: ResetPasswordDto })
  async reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.otp, dto.password);
  }
}
