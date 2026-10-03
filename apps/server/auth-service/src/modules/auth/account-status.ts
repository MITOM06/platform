import { ForbiddenException } from '@nestjs/common';
import { AuthCode } from '../../common/auth-code.enum';

/**
 * Enforce `User.status` on every sign-in path (password login, Google/OIDC,
 * login-code exchange, refresh). `blocked` → 403 ACCOUNT_BLOCKED; legacy
 * `pending` docs → 403 INVITATION_PENDING. Missing status = active (legacy rows).
 */
export function assertCanSignIn(user: { status?: string | null }): void {
  if (user.status === 'blocked') {
    throw new ForbiddenException({ code: AuthCode.ACCOUNT_BLOCKED });
  }
  if (user.status === 'pending') {
    throw new ForbiddenException({ code: AuthCode.INVITATION_PENDING });
  }
}
