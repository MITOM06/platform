import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { REDIS_CLIENT, Redis, User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { ClaimsService } from '../auth/claims.service';
import { SsoPolicyService, ssoRequired } from '../sso/sso-policy.service';
import { MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { enrollmentView, MfaEnrollmentView } from './mfa-enroll-view';
import { isAdminLike } from './mfa-policy';
import { generateTotpSecret } from './totp';

/** Lifetime of a self-service pending secret, restarted by every enroll/start. */
export const MFA_SELF_PENDING_TTL_SECONDS = 10 * 60;

/** Redis key of the pending (unconfirmed) secret of a Settings enrollment. */
export const mfaSelfKey = (userId: string) => `mfa:self:${userId}`;

const SECRET_FIELDS = '+mfa.secretEnc +mfa.backupCodeHashes';

/** Exactly one of them proves the user holds the enrollment being turned off. */
export interface MfaDisableInput {
  code?: unknown;
  backupCode?: unknown;
}

/**
 * Opt-in 2FA from Settings (2026-10-07: optional for Members, mandatory for
 * Owner / Admin-like roles): turn it on (start → confirm → backup codes) and
 * off. JWT endpoints: no session is created or revoked, and errors are 400 /
 * 403 / 404, never 401 (a mistyped code must not trigger the clients'
 * refresh-then-logout). A member covered by "Require SSO" gets 403
 * SSO_REQUIRED (the identity provider owns MFA for them); a bot has no 2FA.
 */
@Injectable()
export class MfaSelfService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly codes: MfaCodeService,
    private readonly crypto: MfaCryptoService,
    private readonly claims: ClaimsService,
    private readonly ssoPolicy: SsoPolicyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A pending secret (encrypted, `mfa:self:<userId>`, 10 minutes). Every call
   * while it lives returns the same secret and restarts its TTL, so a
   * double-fired start or a reload keeps the QR on screen valid.
   */
  async enrollStart(userId: string): Promise<MfaEnrollmentView> {
    const user = await this.loadSelf(userId);
    if (user.mfa?.enabled === true) throw alreadyEnrolled();

    const key = mfaSelfKey(userId);
    const fresh = this.crypto.encrypt(generateTotpSecret(), userId);
    const res = await this.redis
      .multi()
      .set(key, fresh, 'EX', MFA_SELF_PENDING_TTL_SECONDS, 'NX')
      .get(key)
      .expire(key, MFA_SELF_PENDING_TTL_SECONDS)
      .exec();
    const secretEnc = (res?.[1]?.[1] as string | null | undefined) ?? fresh;
    return enrollmentView(user.email, this.crypto.decrypt(secretEnc, userId));
  }

  /**
   * Confirms the pending secret with one code: the account is enrolled
   * (encrypted secret, hashed backup codes) and the 10 backup codes are
   * returned once. 5 wrong codes per 15 minutes, then MFA_TOO_MANY_ATTEMPTS.
   */
  async enrollConfirm(
    userId: string,
    code: unknown,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.loadSelf(userId);
    const key = mfaSelfKey(userId);
    if (user.mfa?.enabled === true) {
      await this.redis.del(key);
      throw alreadyEnrolled();
    }
    await this.codes.assertWithinBudget('enroll', userId);
    const secretEnc = await this.redis.get(key);
    // Never started, or the 10 minutes passed: start again.
    if (!secretEnc) throw notEnrolled();

    const secret = this.crypto.decrypt(secretEnc, userId);
    if (!(await this.codes.checkTotp(userId, secret, code))) {
      await this.codes.rejectWrongCode('enroll', userId);
    }

    const { codes, hashes } = this.codes.newBackupCodes();
    const saved = await this.userModel
      .updateOne(
        { _id: userId, 'mfa.enabled': { $ne: true } },
        {
          $set: {
            mfa: {
              enabled: true,
              secretEnc,
              enrolledAt: new Date(),
              backupCodeHashes: hashes,
            },
          },
        },
      )
      .exec();
    await this.redis.del(key);
    // Enrolled concurrently (another tab confirmed first).
    if (saved.modifiedCount !== 1) throw alreadyEnrolled();

    await this.codes.clearFailures('enroll', userId);
    await this.audit.record({
      actorId: userId,
      action: 'mfa.enrolled',
      targetType: 'member',
      targetId: userId,
      meta: { via: 'settings' },
    });
    return { backupCodes: codes };
  }

  /**
   * Turns optional 2FA off after a current TOTP code or an unused backup code
   * (exactly one): enrollment and backup codes are cleared. Refused for an
   * Owner / Admin-like role (role read from the database). Wrong codes count
   * against the budget shared with backup-code regeneration.
   * Order: 404 / 403 SSO → MFA_REQUIRED_BY_ROLE → MFA_NOT_ENROLLED → budget → code.
   */
  async disable(
    userId: string,
    input: MfaDisableInput,
  ): Promise<{ success: true }> {
    const user = await this.loadSelf(userId, SECRET_FIELDS);
    if (isAdminLike(await this.claims.resolve(userId))) {
      throw new BadRequestException({ code: AuthCode.MFA_REQUIRED_BY_ROLE });
    }
    const mfa = user.mfa;
    if (mfa?.enabled !== true || !mfa.secretEnc) throw notEnrolled();
    await this.codes.assertWithinBudget('account', userId);

    const hasCode = isPresent(input.code);
    const hasBackup = isPresent(input.backupCode);
    let backupHash: string | null = null;
    let ok = false;
    if (hasCode && !hasBackup) {
      const secret = this.crypto.decrypt(mfa.secretEnc, userId);
      ok = await this.codes.checkTotp(userId, secret, input.code);
    } else if (hasBackup && !hasCode) {
      backupHash = this.codes.matchBackupCode(
        mfa.backupCodeHashes ?? [],
        input.backupCode,
      );
      ok = backupHash !== null;
    }
    if (!ok) await this.codes.rejectWrongCode('account', userId);

    // Conditional: a backup code used concurrently elsewhere does not count twice.
    const filter = backupHash
      ? { _id: userId, 'mfa.backupCodeHashes': backupHash }
      : { _id: userId, 'mfa.enabled': true };
    const cleared = await this.userModel
      .updateOne(filter, { $unset: { mfa: 1 } })
      .exec();
    if (cleared.modifiedCount !== 1) throw notEnrolled();

    await this.codes.clearFailures('account', userId);
    await this.audit.record({
      actorId: userId,
      action: 'mfa.disabled',
      targetType: 'member',
      targetId: userId,
      meta: { method: backupHash ? 'backup_code' : 'totp' },
    });
    return { success: true };
  }

  /** The caller's account: 404 if gone or a bot, 403 SSO_REQUIRED if covered by "Require SSO". */
  private async loadSelf(userId: string, select = ''): Promise<UserDocument> {
    let user: UserDocument | null = null;
    if (isValidObjectId(userId)) {
      const query = this.userModel.findById(userId);
      user = await (select ? query.select(select) : query).exec();
    }
    if (!user || user.isBot) {
      throw new NotFoundException({ code: AuthCode.USER_NOT_FOUND });
    }
    if (await this.ssoPolicy.isEnforcedFor(user)) throw ssoRequired();
    return user;
  }
}

function alreadyEnrolled() {
  return new BadRequestException({ code: AuthCode.MFA_ALREADY_ENROLLED });
}

function notEnrolled() {
  return new BadRequestException({ code: AuthCode.MFA_NOT_ENROLLED });
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}
