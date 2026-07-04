import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Guards the internal ai-service <-> connector-service API. Requires an
 * `x-internal-key` header matching INTERNAL_API_KEY.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const raw = req.headers?.['x-internal-key'];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    const expected = this.cfg.get<string>('internalApiKey');

    if (!expected || !provided || typeof provided !== 'string') {
      throw new ForbiddenException('Invalid internal key');
    }

    // Constant-time comparison to prevent timing attacks. timingSafeEqual
    // requires equal-length buffers, so pad `provided` up to the expected
    // length; a genuine length mismatch is caught by the length check.
    const a = Buffer.from(provided.padEnd(expected.length));
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid internal key');
    }
    return true;
  }
}
