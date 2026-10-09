import { Injectable } from '@nestjs/common';
import { AuthCode } from '../../common/auth-code.enum';
import { ClaimsService } from '../auth/claims.service';
import { isAdminLike } from './mfa-policy';
import { MfaPendingStore, MfaSignInContext } from './mfa-pending.store';

/** A user whose first factor was just verified (any UserDocument satisfies it). */
export interface MfaChallengeUser {
  _id: unknown;
  email: string;
  displayName: string;
  isBot?: boolean | null;
  mfa?: { enabled?: boolean } | null;
}

/** 201 body of POST /auth/login, /auth/exchange and invitation accept-password. */
export interface MfaRequiredResult {
  code: AuthCode.MFA_REQUIRED;
  mfaToken: string;
  enrollmentRequired: boolean;
  user: { id: string; email: string; displayName: string };
}

/**
 * The 2FA gate of every password sign-in, Google sign-in (login-code
 * exchange) and invitation accepted with a password. OIDC SSO does not call
 * it: the identity provider owns MFA there.
 */
@Injectable()
export class MfaChallengeService {
  constructor(
    private readonly claims: ClaimsService,
    private readonly pending: MfaPendingStore,
  ) {}

  /**
   * Returns the MFA_REQUIRED answer and opens a pending second step; the
   * caller must NOT issue a session then. Returns null (normal sign-in) for a
   * bot, and for a non-privileged member who has not turned 2FA on.
   * - enrolled (any role, incl. a Member who opted in) → verify;
   * - privileged (Owner / Admin-like, read from the database, never from a
   *   client-held token) and not enrolled → enroll (mandatory).
   */
  async challengeIfRequired(
    user: MfaChallengeUser,
    ctx: MfaSignInContext,
  ): Promise<MfaRequiredResult | null> {
    if (user.isBot === true) return null;
    const userId = String(user._id);
    const enrolled = user.mfa?.enabled === true;
    if (!enrolled && !isAdminLike(await this.claims.resolve(userId))) {
      return null;
    }
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
