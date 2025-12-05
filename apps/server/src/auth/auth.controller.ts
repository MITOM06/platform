import { Controller, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Get('login')
  login(@Query('userId') userId: string) {
    return { token: this.auth.signIn(userId) };
  }
}