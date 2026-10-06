import { Injectable } from '@nestjs/common';
import { AuthCode } from '../../common/auth-code.enum';
import { ClaimsService } from '../auth/claims.service';
import { isMfaPrivileged } from './mfa-policy';
import { MfaPendingStore, MfaSignInContext } from './mfa-pending.store';

/** A user whose credentials were just verified (any UserDocument satisfies it). */
export interface MfaChallengeUser {
  _id: unknown;
  email: string;
  displayName: string;
  mfa?: { enabled?: boolean } | null;
}

/** 201 body of POST /auth/login and /auth/exchange for a privileged user. */
export interface MfaRequiredResult {
  code: AuthCode.MFA_REQUIRED;
  mfaToken: string;
  enrollmentRequired: boolean;
  user: { id: string; email: string; displayName: string };
}

/**
 * The 2FA gate of password login and Google login (login-code exchange). OIDC
 * SSO does not call it: the identity provider owns MFA there.
 */
@Injectable()
export class MfaChallengeService {
  constructor(
    private readonly claims: ClaimsService,
    private readonly pending: MfaPendingStore,
  ) {}

  /**
   * For a privileged user (Owner, Admin or an admin-like role) returns the
   * MFA_REQUIRED answer and opens a pending second step; the caller must NOT
   * issue a session then. Returns null for everyone else (normal sign-in).
   * Privilege comes from the database, never from a client-held token.
   */
  async challengeIfRequired(
    user: MfaChallengeUser,
    ctx: MfaSignInContext,
  ): Promise<MfaRequiredResult | null> {
    const userId = String(user._id);
    if (!isMfaPrivileged(await this.claims.resolve(userId))) return null;

    const enrolled = user.mfa?.enabled === true;
    const mfaToken = await this.pending.create({
      userId,
      stage: enrolled ? 'verify' : 'enroll',
      ...ctx,
    });
    return {
      code: AuthCode.MFA_REQUIRED,
      mfaToken,
      enrollmentRequired: !enrolled,
      user: { id: userId, email: user.email, displayName: user.displayName },
    };
  }
}
