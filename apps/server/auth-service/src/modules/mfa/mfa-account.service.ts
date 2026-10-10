import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Capability, User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { ClaimsService } from '../auth/claims.service';
import { SessionService } from '../auth/session.service';
import { MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { isAdminLike } from './mfa-policy';

const OWNER_ROLE_NAME = 'Owner';

/** Who asks for a 2FA reset: the JWT claims (role changes revoke sessions). */
export interface MfaResetActor {
  sub: string;
  role?: string;
  perms?: readonly string[];
}

/**
 * 2FA management for signed-in users: regenerate one's own backup codes, and
 * the reset of another member's enrollment (Owner: anyone; member manager:
 * non-admin-like members). Errors on these JWT endpoints are never 401, so a
 * mistyped code cannot trigger the clients' refresh-then-logout handling.
 */
@Injectable()
export class MfaAccountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly codes: MfaCodeService,
    private readonly crypto: MfaCryptoService,
    private readonly session: SessionService,
    private readonly audit: AuditService,
    private readonly claims: ClaimsService,
  ) {}

  /** Replaces all backup codes after a valid current TOTP code. */
  async regenerateBackupCodes(userId: string, code: unknown) {
    const user = isValidObjectId(userId)
      ? await this.userModel.findById(userId).select('+mfa.secretEnc').exec()
      : null;
    if (!user?.mfa?.enabled || !user.mfa.secretEnc) {
      throw new BadRequestException({ code: AuthCode.MFA_NOT_ENROLLED });
    }
    // Budget shared with "turn off 2FA" (same enrolled secret).
    await this.codes.assertWithinBudget('account', userId);

    const secret = this.crypto.decrypt(user.mfa.secretEnc, userId);
    if (!(await this.codes.checkTotp(userId, secret, code))) {
      await this.codes.rejectWrongCode('account', userId);
    }
    await this.codes.clearFailures('account', userId);

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
   * Clears another member's enrollment and backup codes, and revokes their
   * sessions; they re-enroll at their next sign-in. An Owner may reset anyone
   * but themself; a member manager (MANAGE_MEMBERS, not Owner) only members
   * who are not Owner / admin-like (target role read from the database).
   * Order: 403 (actor may not reset at all) → 400 self → 404 → 403 (target).
   */
  async resetForMember(actor: MfaResetActor, targetId: string) {
    const actorId = actor.sub;
    const actorIsOwner = actor.role === OWNER_ROLE_NAME;
    const canManage =
      actorIsOwner || (actor.perms ?? []).includes(Capability.MANAGE_MEMBERS);
    if (!canManage) {
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
    if (!actorIsOwner && isAdminLike(await this.claims.resolve(targetId))) {
      throw new ForbiddenException({ code: AuthCode.MFA_RESET_FORBIDDEN });
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
