import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './jwt-user.interface';

/**
 * Param decorator that returns the authenticated {@link JwtUser} from `req.user`.
 * Only meaningful behind {@link JwtAuthGuard}.
 *
 *   findThings(@CurrentUser() user: JwtUser) { return svc.list(user.sub); }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as JwtUser;
  },
);
