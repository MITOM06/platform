import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  // fake login for dev
  signIn(userId: string) {
    return this.jwt.sign({ sub: userId });
  }
}