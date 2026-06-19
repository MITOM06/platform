import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '../rbac/capabilities';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Declare the capability a route requires. Pair with {@link JwtAuthGuard} so
 * `req.user.perms` (from the access-token claims) is populated:
 *
 *   @UseGuards(JwtAuthGuard, RequirePermissionGuard)
 *   @RequirePermission(Capability.ADD_CUSTOM_MCP)
 */
export const RequirePermission = (cap: Capability) =>
  SetMetadata(PERMISSION_KEY, cap);

/**
 * Stateless capability check, importable by every service. Reads the required
 * capability from route metadata and verifies it is present in the caller's
 * `perms` JWT claim. Missing `perms` (pre-enterprise token) => denied. 403s
 * otherwise. Routes with no declared capability only require authentication.
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

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
