import { Controller, Get, Post, Req, Body, Res, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

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
  @UseGuards(AuthGuard('google'))
  async google(@Query('platform') platform: string, @Req() req: any) {
    // ✅ Save platform vào req object — passport sẽ carry theo suốt flow
    // Nhưng req không persist qua redirect — cần dùng cookie
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    // ✅ Lấy platform từ cookie do initiate endpoint set
    const platform = req.cookies?.['oauth_platform'] || 'mobile';
    res.clearCookie('oauth_platform');
    return this.auth.handleSocialLogin(req.user, res, 'google', platform);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebook() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: any, @Res() res: Response) {
    const platform = req.cookies?.['oauth_platform'] || 'mobile';
    res.clearCookie('oauth_platform');
    return this.auth.handleSocialLogin(req.user, res, 'facebook', platform);
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
    const provider = req.params.provider; // google | facebook | twitter

    // Save platform vào cookie — httpOnly để client JS không đọc được
    res.cookie('oauth_platform', platform || 'mobile', {
      httpOnly: true,
      maxAge: 60 * 1000, // 1 phút — chỉ cần sống đủ thời gian OAuth flow
      path: '/',
    });

    // Redirect về endpoint OAuth thật — AuthGuard sẽ kick off OAuth flow
    return res.redirect(`/auth/${provider}`);
  }

  // ===================== AUTH ENDPOINTS =====================
  @Post('exchange')
  async exchange(@Body() body: { code: string; deviceId?: string; platform?: string }) {
    return this.auth.exchangeLoginCode(body.code, body.deviceId, body.platform);
  }

  @Post('refresh')
  async refresh(@Body() body: { sid: string; refreshToken: string }) {
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

  @Post('reset-password')
  async reset(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('password') password: string,
  ) {
    return this.auth.resetPassword(email, otp, password);
  }
}