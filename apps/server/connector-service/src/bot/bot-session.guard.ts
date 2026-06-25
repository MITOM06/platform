import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BotSessionService } from './bot-session.service';

/**
 * Validates the bearer token on MCP endpoint requests.
 * Attaches `request.botSession = { userId, botUserId }` on success.
 */
@Injectable()
export class BotSessionGuard implements CanActivate {
  constructor(private readonly sessions: BotSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers?.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException('Invalid or revoked token');
    req.botSession = session;
    return true;
  }
}
