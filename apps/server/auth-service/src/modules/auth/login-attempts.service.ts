import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';

/**
 * Per-email password brute-force protection: counts failed attempts in Redis
 * and locks the email out for LOCKOUT_DURATION after MAX_FAILED_ATTEMPTS.
 * (Extracted verbatim from AuthService to keep it under the 500-line limit.)
 */
@Injectable()
export class LoginAttemptsService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async checkBruteForce(email: string) {
    const lockoutKey = `lockout:${email}`;
    const isLocked = await this.redis.get(lockoutKey);

    if (isLocked) {
      const ttl = await this.redis.ttl(lockoutKey);
      const minutes = Math.ceil(ttl / 60);
      throw new UnauthorizedException({
        code: AuthCode.ACCOUNT_LOCKED,
        params: { minutes },
      });
    }
  }

  async handleFailedLogin(email: string): Promise<never> {
    const maxAttempts = Number(
      this.configService.get('MAX_FAILED_ATTEMPTS', 5),
    );
    const attemptsTTL = Number(
      this.configService.get('FAILED_LOGIN_ATTEMPTS_TTL', 600),
    );
    const lockoutDuration = Number(
      this.configService.get('LOCKOUT_DURATION', 300),
    );

    const attemptKey = `failed_attempts:${email}`;
    const attempts = await this.redis.incr(attemptKey);

    if (attempts === 1) {
      await this.redis.expire(attemptKey, attemptsTTL);
    }

    if (attempts >= maxAttempts) {
      await this.redis.set(`lockout:${email}`, '1', 'EX', lockoutDuration);
      await this.redis.del(attemptKey);
      throw new UnauthorizedException({
        code: AuthCode.LOGIN_FAILED_LOCKED,
        params: { maxAttempts, minutes: Math.ceil(lockoutDuration / 60) },
      });
    }

    const remaining = maxAttempts - attempts;
    throw new UnauthorizedException({
      code: AuthCode.LOGIN_FAILED_WITH_REMAINING,
      params: { remaining },
    });
  }

  /** Clear the failed-attempt counter (successful or non-guess sign-in). */
  async reset(email: string): Promise<void> {
    await this.redis.del(`failed_attempts:${email}`);
  }
}
