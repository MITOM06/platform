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
  BadRequestException,
  Type,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AuthService } from './auth.service';
import { OidcService } from './oidc/oidc.service';
import type { Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ExchangeDto, ExchangeResponseDto } from './dto/exchange.dto';
import { LoginTokensResponseDto } from '../invitations/dto/invitation-view.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { normalizeLocale } from '../Email/otp-i18n';
import { AuthCode } from '../../common/auth-code.enum';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { SENSITIVE_THROTTLE } from './throttle';
import { MfaRequiredResponseDto } from '../mfa/dto/mfa.dto';
import { SsoPolicyService } from '../sso/sso-policy.service';
import { SsoInfoResponseDto } from '../sso/dto/sso-info.dto';
import { PasswordRecoveryService } from './password-recovery.service';

/** 201 of login / exchange: MFA_REQUIRED (2FA step), or tokens (SSO / bot). */
const signInResponse = (tokens: Type<unknown>, description: string) => ({
  status: 201,
  description,
  schema: {
    oneOf: [
      { $ref: getSchemaPath(tokens) },
      { $ref: getSchemaPath(MfaRequiredResponseDto) },
    ],
  },
});

// Social login providers PON supports. Team decision: Google only —
// X/Twitter and Facebook are intentionally not supported (see docs/decisions.md).
const SUPPORTED_SOCIAL_PROVIDERS = ['google'];

@ApiTags('auth')
@ApiExtraModels(ExchangeResponseDto, LoginTokensResponseDto, MfaRequiredResponseDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
    private readonly oidc: OidcService,
    private readonly ssoPolicy: SsoPolicyService,
    private readonly recovery: PasswordRecoveryService,
    private readonly invitations: InvitationAcceptService,
    private readonly oauthRedirect: OAuthRedirectService,
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
    // ✅ Platform travels in the OAuth `state` param (echoed back by Google) as
    // "<platform>" (login) or "<platform>.<flowId>" (invite accept). Fall back
    // to the cookie for backwards compatibility / older links.
    const [statePlatform, flowId] = String(req.query?.state ?? '').split('.', 2);
    const platform =
      statePlatform || req.cookies?.['oauth_platform'] || 'mobile';
    res.clearCookie('oauth_platform');
    // Browser navigation: failures must redirect with ?error=CODE, never JSON.
    try {
      if (flowId) {
        const userId = await this.invitations.acceptWithGoogle(flowId, req.user);
        return await this.oauthRedirect.redirectWithLoginCode(userId, res, platform);
      }
      return await this.auth.handleSocialLogin(req.user, res, 'google', platform);
    } catch (err) {
      return this.oauthRedirect.redirectWithError(res, platform, err);
    }
  }

  // ===================== SET PLATFORM COOKIE =====================
  // Client gọi endpoint này TRƯỚC khi redirect sang OAuth
  // Endpoint này save platform vào cookie rồi redirect về /auth/{provider}
  // Cách này giải quyết vấn đề platform bị mất sau OAuth redirect
  @Get('social/:provider/init')
  @ApiOperation({
    summary: 'Persist platform then redirect into the provider OAuth flow',
  })
  @ApiQuery({ name: 'platform', required: false, enum: ['web', 'mobile'] })
  @ApiQuery({
    name: 'invite',
    required: false,
    description: 'Invitation token: accept the invitation with Google',
  })
  async initSocialLogin(
    @Req() req: any,
    @Res() res: Response,
    @Query('platform') platform: string,
    @Query('invite') invite?: string,
  ) {
    const provider = req.params.provider;
    if (!SUPPORTED_SOCIAL_PROVIDERS.includes(provider)) {
      throw new BadRequestException({
        code: AuthCode.SOCIAL_PROVIDER_UNSUPPORTED,
      });
    }
    // Only 'web' is special-cased downstream; anything else is the mobile bridge.
    // Normalising keeps '.' (the state separator) out of the platform value.
    const resolvedPlatform = platform === 'web' ? 'web' : 'mobile';

    // Invite accept: validate now (error → redirect, not JSON) and carry only a
    // short-lived single-use flow id through OAuth — never the raw invite token.
    let flowQuery = '';
    if (invite) {
      try {
        const flowId = await this.invitations.startGoogleFlow(invite);
        flowQuery = `&flow=${encodeURIComponent(flowId)}`;
      } catch (err) {
        return this.oauthRedirect.redirectWithError(res, resolvedPlatform, err);
      }
    }

    // Fallback cookie: the primary carrier is the OAuth `state` param, set by
    // GoogleOAuthGuard from ?platform=. Keep it long enough to outlive the
    // consent screen, with SameSite/Secure so it survives the cross-site redirect.
    res.cookie('oauth_platform', resolvedPlatform, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 phút — đủ cho cả màn hình consent của Google
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    // Carry platform (+ flow) in the query so GoogleOAuthGuard can forward it as `state`.
    return res.redirect(
      `/auth/${provider}?platform=${encodeURIComponent(resolvedPlatform)}${flowQuery}`,
    );
  }

  // ===================== OIDC SSO =====================
  @Get('oidc/login')
  @ApiOperation({ summary: 'Begin OIDC SSO (redirects to the IdP)' })
  async oidcLogin(@Query('platform') platform: string, @Res() res: Response) {
    if (!this.oidc.isEnabledByEnv()) {
      return res.status(404).send('SSO not configured');
    }
    // IdP unreachable (discovery failed) → ?error=SSO_UNAVAILABLE, not a raw 500.
    try {
      const url = await this.oidc.buildAuthorizeUrl(platform || 'web');
      return res.redirect(url);
    } catch (err) {
      return this.oauthRedirect.redirectWithError(res, platform || 'web', err);
    }
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'OIDC callback (redirects back to client)' })
  async oidcCallback(@Req() req: any, @Res() res: Response) {
    // handleCallback returns the chosen platform (stored in the Redis flow at
    // /oidc/login). Until it succeeds the platform is unknown → web.
    let platform = 'web';
    try {
      const { platform: flowPlatform, ...profile } =
        await this.oidc.handleCallback(req.query);
      platform = flowPlatform || 'web';
      return await this.auth.handleOidcLogin(profile, res, platform);
    } catch (err) {
      return this.oauthRedirect.redirectWithError(res, platform, err);
    }
  }

  @Get('sso/info')
  @ApiOperation({
    summary: 'Public: whether the SSO button shows and whether SSO is required',
  })
  @ApiOkResponse({ type: SsoInfoResponseDto })
  ssoInfo() {
    return this.ssoPolicy.publicInfo();
  }

  // ===================== AUTH ENDPOINTS =====================
  @Post('exchange')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Exchange a one-time login code for tokens' })
  @ApiResponse(
    signInResponse(
      ExchangeResponseDto,
      'MFA_REQUIRED (Google sign-in of an Owner / Admin-like role, or of a member who turned 2FA on), else tokens (incl. OIDC SSO). 403 SSO_REQUIRED when the workspace requires SSO for this member',
    ),
  )
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

  @Post('login')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  @ApiResponse(
    signInResponse(
      LoginTokensResponseDto,
      'MFA_REQUIRED (2FA step: always for Owner / Admin-like roles, for other members once they turned 2FA on), else LOGIN_SUCCESS + tokens',
    ),
  )
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({
    status: 403,
    description: 'SSO_REQUIRED: the workspace requires SSO for this email domain',
  })
  async login(
    @Body() dto: LoginDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.auth.login(dto, normalizeLocale(acceptLang));
  }

  // ✅ Logout — yêu cầu JWT token trong header
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Req() req: any) {
    // The session to end is the one this access token belongs to (`sid` claim,
    // already checked against Redis by the JWT strategy) — never a body field.
    // Taking `sid` from the body let any signed-in user end someone else's
    // session, and a missing body sid wrote a junk `sess:undefined` key.
    // Clients still send `{ sid }`; it is ignored.
    return this.auth.logout(req.user.sub, req.user.sid);
  }

  // ===================== FORGOT PASSWORD =====================
  @Post('forgot-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Send a password-reset OTP to the email' })
  async forgot(
    @Body() dto: ForgotPasswordDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.recovery.forgotPassword(dto.email, normalizeLocale(acceptLang));
  }

  @Post('verify-otp')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Verify a password-reset OTP' })
  @ApiBody({ type: VerifyOtpDto })
  async verify(@Body() dto: VerifyOtpDto) {
    return this.recovery.verifyOtp(dto.email, dto.otp);
  }

  @Post('resend-otp')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Resend a password-reset OTP' })
  @ApiBody({ type: ResendOtpDto })
  async resend(
    @Body() dto: ResendOtpDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.recovery.resendOtp(dto.email, normalizeLocale(acceptLang));
  }

  @Post('reset-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Reset password using a verified OTP' })
  @ApiBody({ type: ResetPasswordDto })
  async reset(@Body() dto: ResetPasswordDto) {
    return this.recovery.resetPassword(dto.email, dto.otp, dto.password);
  }
}
