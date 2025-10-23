import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() _dto: RegisterDto) { return this.auth.register(); }
  @Post('login') login(@Body() _dto: LoginDto) { return this.auth.login(); }
}
