import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '@platform/database';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Declare the capability a route requires. Use together with the JWT auth guard
 * so `req.user.perms` (from the access-token claims) is populated:
 *
 *   @UseGuards(AuthGuard('jwt'), RequirePermissionGuard)
 *   @RequirePermission(Capability.MANAGE_MEMBERS)
 */
export const RequirePermission = (cap: Capability) =>
  SetMetadata(PERMISSION_KEY, cap);

/**
 * Stateless capability check: reads the required capability from route metadata
 * and verifies it is present in the caller's `perms` JWT claim. 403s otherwise.
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No capability declared => the route only needs authentication.
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const perms: string[] = req?.user?.perms ?? [];

    if (!perms.includes(required)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        required,
      });
    }
    return true;
  }
}
