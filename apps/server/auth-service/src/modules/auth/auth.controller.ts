import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  Res,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ExchangeDto } from './dto/exchange.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ===================== SOCIAL LOGIN =====================
  // Client gọi /auth/google?platform=web hoặc ?platform=mobile
  // Google redirect về /auth/google/callback — nhưng query param 'platform' bị mất
  // Nên client cần pass platform qua 'state' param, backend save state trước khi redirect
  // Cách đơn giản hơn: save platform vào session/cookie trước khi redirect sang Google

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async google() {
    // GoogleOAuthGuard reads ?platform=… and forwards it through the OAuth
    // `state` param, so the callback can recover it cookie-independently.
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
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
  async twitter() {}

  @Get('twitter/callback')
  @UseGuards(AuthGuard('twitter'))
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

  // ===================== AUTH ENDPOINTS =====================
  @Post('exchange')
  async exchange(@Body() body: ExchangeDto) {
    return this.auth.exchangeLoginCode(body.code, body.deviceId, body.platform);
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.sid, body.refreshToken);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // ✅ Logout — yêu cầu JWT token trong header
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any, @Body() body: { sid: string }) {
    return this.auth.logout(req.user.sub, body.sid);
  }

  // ===================== FORGOT PASSWORD =====================
  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('verify-otp')
  async verify(@Body('email') email: string, @Body('otp') otp: string) {
    return this.auth.verifyOtp(email, otp);
  }

  @Post('resend-otp')
  async resend(@Body('email') email: string) {
    return this.auth.resendOtp(email);
  }

  @Post('reset-password')
  async reset(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('password') password: string,
  ) {
    return this.auth.resetPassword(email, otp, password);
  }
}
