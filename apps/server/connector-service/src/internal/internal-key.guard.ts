import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guards the internal ai-service <-> connector-service API. Requires an
 * `x-internal-key` header matching INTERNAL_API_KEY.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers?.['x-internal-key'];
    const expected = this.cfg.get<string>('internalApiKey');
    if (!expected || !provided || provided !== expected) {
      throw new ForbiddenException('Invalid internal key');
    }
    return true;
  }
}
