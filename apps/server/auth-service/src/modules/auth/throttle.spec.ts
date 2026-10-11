import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import {
  REFRESH_THROTTLE,
  SENSITIVE_THROTTLE,
  throttlerOptions,
} from './throttle';

@Controller('auth')
class ProbeController {
  @Post('refresh')
  @Throttle(REFRESH_THROTTLE)
  refresh(@Body() _body: { sid?: string }) {
    return { ok: true };
  }

  @Post('login')
  @Throttle(SENSITIVE_THROTTLE)
  login() {
    return { ok: true };
  }
}

/**
 * The web app refreshes tokens from its own server (Next.js route on Vercel), so
 * every web user reached /auth/refresh from the same few addresses: a per-IP
 * 5/minute bucket was shared by all of them, and active users were signed out.
 * Refresh is now limited per session (sid); the per-address cap is high.
 */
describe('auth throttling', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions())],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterEach(() => app.close());

  it('many users refreshing through one server address are not throttled', async () => {
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ sid: `sid-${i}`, refreshToken: 'r' })
        .expect(201);
    }
  });

  it('one session refreshing in a loop is throttled', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ sid: 'same', refreshToken: 'r' });
      codes.push(res.status);
    }
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true);
    expect(codes[11]).toBe(429);
  });

  it('login keeps its strict per-address limit', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push(
        (await request(app.getHttpServer()).post('/auth/login').send({}))
          .status,
      );
    }
    expect(codes[5]).toBe(429);
  });
});
