import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { MfaCodeService, MFA_FAILURE_LIMITS } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';

const OWNER_ROLE_NAME = 'Owner';

/**
 * 2FA management for signed-in users: regenerate one's own backup codes, and
 * the Owner-only reset of another member's enrollment. Errors on these JWT
 * endpoints are never 401, so a mistyped code cannot trigger the clients'
 * refresh-then-logout handling.
 */
@Injectable()
export class MfaAccountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly codes: MfaCodeService,
    private readonly crypto: MfaCryptoService,
    private readonly session: SessionService,
    private readonly audit: AuditService,
  ) {}

  /** Replaces all backup codes after a valid current TOTP code. */
  async regenerateBackupCodes(userId: string, code: unknown) {
    const user = isValidObjectId(userId)
      ? await this.userModel.findById(userId).select('+mfa.secretEnc').exec()
      : null;
    if (!user?.mfa?.enabled || !user.mfa.secretEnc) {
      throw new BadRequestException({ code: AuthCode.MFA_NOT_ENROLLED });
    }
    const { limit } = MFA_FAILURE_LIMITS.regen;
    if ((await this.codes.failures('regen', userId)) >= limit) {
      throw new BadRequestException({ code: AuthCode.MFA_TOO_MANY_ATTEMPTS });
    }

    const secret = this.crypto.decrypt(user.mfa.secretEnc, userId);
    if (!(await this.codes.checkTotp(userId, secret, code))) {
      const failures = await this.codes.recordFailure('regen', userId);
      if (failures >= limit) {
        throw new BadRequestException({ code: AuthCode.MFA_TOO_MANY_ATTEMPTS });
      }
      throw new BadRequestException({
        code: AuthCode.MFA_CODE_INVALID,
        params: { remaining: limit - failures },
      });
    }
    await this.codes.clearFailures('regen', userId);

    const { codes, hashes } = this.codes.newBackupCodes();
    await this.userModel
      .updateOne(
        { _id: userId, 'mfa.enabled': true },
        { $set: { 'mfa.backupCodeHashes': hashes } },
      )
      .exec();
    await this.audit.record({
      actorId: userId,
      action: 'mfa.backup_codes_regenerated',
      targetType: 'member',
      targetId: userId,
    });
    return { backupCodes: codes };
  }

  /**
   * Owner-only: clears another member's enrollment and backup codes, and
   * revokes their sessions; they re-enroll at their next sign-in. The actor's
   * role comes from the JWT (role changes revoke sessions, so it is fresh).
   */
  async resetForMember(
    actorId: string,
    actorRole: string | undefined,
    targetId: string,
  ) {
    if (actorRole !== OWNER_ROLE_NAME) {
      throw new ForbiddenException({ code: AuthCode.MFA_RESET_FORBIDDEN });
    }
    if (targetId === actorId) {
      throw new BadRequestException({
        code: AuthCode.MFA_RESET_SELF_FORBIDDEN,
      });
    }
    const member = isValidObjectId(targetId)
      ? await this.userModel
          .findById(targetId)
          .select('isBot mfa.enabled')
          .exec()
      : null;
    // A bot account is not a member.
    if (!member || member.isBot) {
      throw new NotFoundException({ code: AuthCode.MEMBER_NOT_FOUND });
    }

    await this.userModel
      .updateOne({ _id: targetId }, { $unset: { mfa: 1 } })
      .exec();
    await this.session.revokeAllSessions(targetId, 'mfa_reset');
    await this.audit.record({
      actorId,
      action: 'mfa.reset',
      targetType: 'member',
      targetId,
      meta: { wasEnabled: member.mfa?.enabled === true },
    });
    return { success: true };
  }
}
