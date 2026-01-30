import { Controller, Get, Post, Req, Body, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly configService: ConfigService) {}

  // --- GOOGLE ---
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async google() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    return this.handleSocialLogin(req, res, 'google');
  }

  // --- FACEBOOK ---
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebook() {}

@Get('facebook/callback')
@UseGuards(AuthGuard('facebook'))
async facebookCallback(@Req() req: any, @Res() res: Response) {
  
  // Kiểm tra xem req.user có dữ liệu không
  const userId = await this.auth.ensureUserIdFromSocial(req.user, 'facebook');

  const code = await this.auth.createLoginCode(userId);

  const deeplink = process.env.MOBILE_DEEPLINK_URL ?? 'flatform://auth';
  return res.redirect(`${deeplink}?code=${code}`);
}

  // --- X (TWITTER) ---
  @Get('twitter') // Hoặc dùng 'x' nếu bạn cấu hình Strategy name là 'x'
  @UseGuards(AuthGuard('twitter'))
  async twitter() {}

  @Get('twitter/callback')
  @UseGuards(AuthGuard('twitter'))
  async twitterCallback(@Req() req: any, @Res() res: Response) {
    return this.handleSocialLogin(req, res, 'twitter');
  }

  // --- HÀM XỬ LÝ CHUNG (Private Helper) ---
  // Tách ra để không phải viết lại logic redirect 3 lần
  private async handleSocialLogin(req: any, res: Response, provider: string) {
    // Gọi hàm ensureUserIdFromSocial mới của bạn
    const userId = await this.auth.ensureUserIdFromSocial(req.user, provider);
    
    // Tạo mã login tạm thời (lưu trong Redis 60s)
    const code = await this.auth.createLoginCode(userId);

    // Bắn về Mobile App qua Deep Link
    const deeplink = this.configService.get<string>('MOBILE_DEEPLINK_URL') ?? 'flatform://auth';
    
    return res.redirect(`${deeplink}?code=${code}`);
  }

  // --- CÁC ENDPOINT KHÁC ---
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
}