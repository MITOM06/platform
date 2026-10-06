import { Allow } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MIN_PASSWORD_LENGTH } from '../../../common/password-policy';

/**
 * POST /api/users/me/change-password. Fields are only whitelisted here: the
 * rules are enforced in UsersService.changePassword so every failure answers a
 * typed `{ code }` (VAL_PASSWORD_TOO_SHORT, CURRENT_PASSWORD_REQUIRED, ...)
 * instead of class-validator's message array.
 */
export class ChangePasswordDto {
  @ApiPropertyOptional({
    description:
      'Required only when the account already has a password (omit when setting the first one)',
  })
  @Allow()
  currentPassword?: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH, example: 'N3wP@ssw0rd' })
  @Allow()
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}
