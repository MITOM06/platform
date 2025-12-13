import { Injectable } from '@nestjs/common';
@Injectable()
export class AuthService {
  async register() { return { ok: true }; }
  async login() { return { ok: true, token: 'mock' }; }
}
