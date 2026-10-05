import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { SessionService } from '../auth/session.service';
import { UsersService } from './users.service';

/** Same floor as invitation accept (AcceptInvitationPasswordDto) and both clients. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * 409 body carrying BOTH the typed code (new clients map it) and the legacy
 * English `message` (shipped mobile/web builds match substrings of it), in the
 * same `{statusCode, message, error}` envelope a plain ConflictException had.
 */
function conflict(
  code: AuthCode,
  message: string,
  params?: Record<string, unknown>,
): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code,
    message,
    ...(params ? { params } : {}),
  });
}

/**
 * POST /api/users/me/change-password (also "set a first password" for
 * Google-only accounts). A successful change signs every OTHER session out —
 * whoever else held a session may be the reason the password is being changed
 * — while the session that made the change stays signed in.
 */
@Injectable()
export class PasswordChangeService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly users: UsersService,
    private readonly session: SessionService,
  ) {}

  async changePassword(
    userId: string,
    currentSid: string | undefined,
    currentPassword?: string,
    newPassword?: string,
  ): Promise<{ success: boolean }> {
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < MIN_PASSWORD_LENGTH
    ) {
      throw conflict(
        AuthCode.VAL_PASSWORD_TOO_SHORT,
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        { min: MIN_PASSWORD_LENGTH },
      );
    }

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) throw conflict(AuthCode.USER_NOT_FOUND, 'User not found');

    if (user.password) {
      if (!currentPassword) {
        throw conflict(
          AuthCode.CURRENT_PASSWORD_REQUIRED,
          'Current password is required',
        );
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw conflict(
          AuthCode.CURRENT_PASSWORD_INCORRECT,
          'Incorrect current password',
        );
      }
    }

    const hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await this.users.updatePassword(userId, hash);

    if (currentSid) {
      await this.session.revokeOtherSessions(userId, currentSid);
    } else {
      // No session id on the token (should not happen behind JwtStrategy):
      // fail safe and revoke everything.
      await this.session.revokeAllSessions(userId, 'password_reset');
    }
    return { success: true };
  }
}
