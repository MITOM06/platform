import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { assertCanSignIn } from '../auth/account-status';
import { MfaCodeService, MFA_FAILURE_LIMITS } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import {
  MFA_MAX_ATTEMPTS,
  MfaPending,
  MfaPendingStore,
  MfaSignInContext,
  MfaStage,
} from './mfa-pending.store';
import { generateTotpSecret, totpKeyUri } from './totp';

/** Client-supplied session fields of confirm / complete / verify. */
export interface MfaDeviceInput {
  deviceId?: unknown;
  platform?: unknown;
}

/** A passed second step: the caller issues the session for `user`. */
export interface MfaSignInResult extends MfaSignInContext {
  user: UserDocument;
}

const SECRET_FIELDS = '+mfa.secretEnc +mfa.backupCodeHashes';

/**
 * Second step of a privileged sign-in (public endpoints, authenticated by the
 * mfaToken only): enroll an authenticator (start → confirm → codes → complete),
 * or verify a TOTP / backup code. Never issues tokens itself; the auth-side
 * controller does once enroll/complete or verify passes.
 */
@Injectable()
export class MfaService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly pending: MfaPendingStore,
    private readonly codes: MfaCodeService,
    private readonly crypto: MfaCryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Same pending secret for every call with one token. */
  async enrollStart(mfaToken: unknown) {
    const p = await this.requirePending(mfaToken, 'enroll');
    const user = await this.loadUser(p);
    const secretEnc =
      p.secretEnc ??
      (await this.pending.setSecretIfAbsent(
        p.key,
        this.crypto.encrypt(generateTotpSecret(), p.userId),
      ));
    if (!secretEnc) throw tokenInvalid();

    const secret = this.crypto.decrypt(secretEnc, p.userId);
    const otpauthUrl = totpKeyUri(user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });
    return { otpauthUrl, secret, qrDataUrl };
  }

  /**
   * Confirms the pending secret with one code and enrolls the account. Issues
   * NO session: the 10 backup codes are returned and kept (encrypted) in the
   * `codes_pending` record, so a reload can show them again; the session comes
   * only from enroll/complete, once the user acknowledged them.
   */
  async enrollConfirm(
    dto: { mfaToken?: unknown; code?: unknown } & MfaDeviceInput,
  ): Promise<{ backupCodes: string[] }> {
    const p = await this.requirePending(dto.mfaToken, 'enroll');
    if (!p.secretEnc) {
      throw new BadRequestException({ code: AuthCode.MFA_NOT_ENROLLED });
    }
    await this.loadUser(p);
    await this.assertWithinUserBudget(p);

    const secret = this.crypto.decrypt(p.secretEnc, p.userId);
    if (!(await this.codes.checkTotp(p.userId, secret, dto.code))) {
      return this.failAttempt(p);
    }
    if (!(await this.pending.consume(p.key))) throw tokenInvalid();

    const { codes, hashes } = this.codes.newBackupCodes();
    const enrolledAt = new Date();
    const saved = await this.userModel
      .updateOne(
        { _id: p.userId, 'mfa.enabled': { $ne: true } },
        {
          $set: {
            mfa: {
              enabled: true,
              secretEnc: p.secretEnc,
              enrolledAt,
              backupCodeHashes: hashes,
            },
          },
        },
      )
      .exec();
    if (saved.modifiedCount !== 1) {
      throw new BadRequestException({ code: AuthCode.MFA_ALREADY_ENROLLED });
    }
    // Device fields sent here become the defaults of enroll/complete.
    await this.pending.openCodesPending(p.key, {
      userId: p.userId,
      ...signInContext(p, dto),
      backupCodesEnc: this.crypto.encrypt(JSON.stringify(codes), p.userId),
      enrolledAt: enrolledAt.getTime(),
    });
    await this.codes.clearFailures('signin', p.userId);
    await this.audit.record({
      actorId: p.userId,
      action: 'mfa.enrolled',
      targetType: 'member',
      targetId: p.userId,
    });
    return { backupCodes: codes };
  }

  /** The backup codes issued by enroll/confirm, again (e.g. after a page reload). */
  async enrollCodes(mfaToken: unknown): Promise<{ backupCodes: string[] }> {
    const { p } = await this.requireCodesPending(mfaToken);
    const codes: unknown = JSON.parse(
      this.crypto.decrypt(p.backupCodesEnc!, p.userId),
    );
    if (!Array.isArray(codes) || !codes.every((c) => typeof c === 'string')) {
      throw new Error('Corrupt mfa codes_pending record');
    }
    return { backupCodes: codes };
  }

  /**
   * Backup codes acknowledged: consumes the `codes_pending` record (the
   * plaintext codes are gone) and lets the caller issue the session. Single use.
   */
  async enrollComplete(
    dto: { mfaToken?: unknown } & MfaDeviceInput,
  ): Promise<MfaSignInResult> {
    const { p, user } = await this.requireCodesPending(dto.mfaToken);
    if (!(await this.pending.consume(p.key))) throw tokenInvalid();
    return { user, ...signInContext(p, dto) };
  }

  /** Verifies exactly one of `code` (TOTP) or `backupCode` (consumed). */
  async verify(
    dto: {
      mfaToken?: unknown;
      code?: unknown;
      backupCode?: unknown;
    } & MfaDeviceInput,
  ): Promise<MfaSignInResult & { backupCodesRemaining: number }> {
    const p = await this.requirePending(dto.mfaToken, 'verify');
    const user = await this.loadUser(p, SECRET_FIELDS);
    const mfa = user.mfa;
    if (mfa?.enabled !== true || !mfa.secretEnc) {
      // Reset by an Owner after the password step: restart → enrollment.
      await this.pending.consume(p.key);
      throw tokenInvalid();
    }
    await this.assertWithinUserBudget(p);

    const hashes = mfa.backupCodeHashes ?? [];
    const hasCode = isPresent(dto.code);
    const hasBackup = isPresent(dto.backupCode);
    let backupHash: string | null = null;
    let ok = false;
    if (hasCode && !hasBackup) {
      const secret = this.crypto.decrypt(mfa.secretEnc, p.userId);
      ok = await this.codes.checkTotp(p.userId, secret, dto.code);
    } else if (hasBackup && !hasCode) {
      backupHash = this.codes.matchBackupCode(hashes, dto.backupCode);
      ok = backupHash !== null;
    }
    if (!ok) return this.failAttempt(p);
    if (!(await this.pending.consume(p.key))) throw tokenInvalid();

    let remaining = hashes.length;
    if (backupHash) {
      // Conditional pull: a code used concurrently elsewhere is not accepted twice.
      const pulled = await this.userModel
        .updateOne(
          { _id: p.userId, 'mfa.backupCodeHashes': backupHash },
          { $pull: { 'mfa.backupCodeHashes': backupHash } },
        )
        .exec();
      if (pulled.modifiedCount !== 1) throw tokenInvalid();
      remaining -= 1;
      await this.audit.record({
        actorId: p.userId,
        action: 'mfa.verified_backup_code',
        targetType: 'member',
        targetId: p.userId,
        meta: { remaining },
      });
    }
    await this.codes.clearFailures('signin', p.userId);
    return { user, ...signInContext(p, dto), backupCodesRemaining: remaining };
  }

  /**
   * Wrong stage → 400: enroll/start|confirm answer MFA_ALREADY_ENROLLED;
   * verify and enroll/codes|complete answer MFA_NOT_ENROLLED.
   */
  private async requirePending(
    token: unknown,
    stage: MfaStage,
  ): Promise<MfaPending> {
    const p = await this.pending.get(token);
    if (!p) throw tokenInvalid();
    if (p.stage !== stage) {
      throw new BadRequestException({
        code:
          stage === 'enroll'
            ? AuthCode.MFA_ALREADY_ENROLLED
            : AuthCode.MFA_NOT_ENROLLED,
      });
    }
    return p;
  }

  /**
   * A `codes_pending` record whose enrollment is still the one on the account.
   * 2FA reset by an Owner since confirm (or reset and re-enrolled elsewhere):
   * the record is burned and no session is issued; restart sign-in.
   */
  private async requireCodesPending(
    token: unknown,
  ): Promise<{ p: MfaPending; user: UserDocument }> {
    const p = await this.requirePending(token, 'codes_pending');
    const user = await this.loadUser(p);
    const mfa = user.mfa;
    if (
      mfa?.enabled !== true ||
      !p.backupCodesEnc ||
      p.enrolledAt === undefined ||
      epochMs(mfa.enrolledAt) !== p.enrolledAt
    ) {
      await this.pending.consume(p.key);
      throw tokenInvalid();
    }
    return { p, user };
  }

  /** Re-checks the account between the password step and now (deleted / blocked / enrolled). */
  private async loadUser(p: MfaPending, select = ''): Promise<UserDocument> {
    const query = this.userModel.findById(p.userId);
    const user = await (select ? query.select(select) : query).exec();
    if (!user || user.isBot) {
      await this.pending.consume(p.key);
      throw tokenInvalid();
    }
    if (user.status === 'blocked' || user.status === 'pending') {
      await this.pending.consume(p.key);
      assertCanSignIn(user);
    }
    if (p.stage === 'enroll' && user.mfa?.enabled === true) {
      await this.pending.consume(p.key);
      throw new BadRequestException({ code: AuthCode.MFA_ALREADY_ENROLLED });
    }
    return user;
  }

  private async assertWithinUserBudget(p: MfaPending): Promise<void> {
    const failures = await this.codes.failures('signin', p.userId);
    if (failures >= MFA_FAILURE_LIMITS.signin.limit) {
      await this.pending.consume(p.key);
      throw tooManyAttempts();
    }
  }

  /** Wrong code: count it, burn the token on the 5th, else report what is left. */
  private async failAttempt(p: MfaPending): Promise<never> {
    await this.codes.recordFailure('signin', p.userId);
    const attempts = await this.pending.recordFailure(p.key);
    if (attempts === null) throw tokenInvalid();
    if (attempts >= MFA_MAX_ATTEMPTS) {
      await this.pending.consume(p.key);
      throw tooManyAttempts();
    }
    throw new UnauthorizedException({
      code: AuthCode.MFA_CODE_INVALID,
      params: { remaining: MFA_MAX_ATTEMPTS - attempts },
    });
  }
}

function tokenInvalid() {
  return new UnauthorizedException({ code: AuthCode.MFA_TOKEN_INVALID });
}

function tooManyAttempts() {
  return new UnauthorizedException({ code: AuthCode.MFA_TOO_MANY_ATTEMPTS });
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** Session fields: the client's own (if usable), else those of the sign-in. */
function signInContext(
  p: MfaSignInContext,
  dto: MfaDeviceInput,
): MfaSignInContext {
  return {
    deviceId: deviceField(dto.deviceId) ?? p.deviceId,
    platform: deviceField(dto.platform) ?? p.platform,
  };
}

/** Epoch ms of a stored date (Date, ISO string or number), NaN if absent. */
function epochMs(value: unknown): number {
  if (value === undefined || value === null) return NaN;
  return new Date(value as Date | string | number).getTime();
}

/** A usable client-supplied deviceId / platform, else undefined. */
function deviceField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : undefined;
}
