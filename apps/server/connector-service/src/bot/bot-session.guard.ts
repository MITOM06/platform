import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Capability } from '@platform/database';
import { PermResolverService } from '../internal/perm-resolver.service';
import { BotSessionService } from './bot-session.service';

/**
 * Validates the bearer token on MCP endpoint requests, then the OWNING
 * member's live standing — on every request, so blocking a member or removing
 * USE_PERSONAL_ASSISTANT from their role cuts their Bot Factory assistant off
 * immediately (tokens used to survive both).
 * Attaches `request.botSession = { userId, botUserId }` on success.
 */
@Injectable()
export class BotSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly perms: PermResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers?.authorization;
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException({ code: 'BOT_TOKEN_MISSING' });
    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException({ code: 'BOT_TOKEN_INVALID' });
    const member = await this.perms.resolveMember(session.userId);
    if (!member.active) throw new ForbiddenException({ code: 'MEMBER_INACTIVE' });
    if (!member.perms.has(Capability.USE_PERSONAL_ASSISTANT)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        required: Capability.USE_PERSONAL_ASSISTANT,
      });
    }
    req.botSession = session;
    return true;
  }
}
