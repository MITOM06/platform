import { Controller, Get, Post, Req, Body, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  google() {
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const userId = await this.auth.ensureUserIdFromGoogle(req.user);
    const code = await this.auth.createLoginCode(userId);

    const deeplink = process.env.MOBILE_DEEPLINK_URL ?? 'chatapp://auth';
    return res.redirect(`${deeplink}?code=${code}`);
  }

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

