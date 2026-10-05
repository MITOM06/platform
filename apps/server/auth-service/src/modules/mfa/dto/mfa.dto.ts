import { Allow } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoginTokensResponseDto } from '../../invitations/dto/invitation-view.dto';

// Request fields are only whitelisted (@Allow): every rule is enforced in the
// MFA services so each failure is a typed top-level `{ code, params }`
// (MFA_TOKEN_INVALID, MFA_CODE_INVALID, ...), never class-validator's message[].

/** Optional session fields of complete/verify (default: the values of the sign-in). */
class MfaDeviceFields {
  @ApiPropertyOptional({
    description: 'Device identifier for the issued session',
  })
  @Allow()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Originating platform', example: 'web' })
  @Allow()
  platform?: string;
}

export class MfaEnrollStartDto {
  @ApiProperty({ description: 'mfaToken from the MFA_REQUIRED sign-in answer' })
  @Allow()
  mfaToken: string;
}

/**
 * Confirm issues no session. `deviceId` / `platform` are still accepted here
 * (older clients send them) and become the defaults of enroll/complete.
 */
export class MfaEnrollConfirmDto extends MfaDeviceFields {
  @ApiProperty()
  @Allow()
  mfaToken: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit code from the authenticator app',
  })
  @Allow()
  code: string;
}

export class MfaEnrollCodesDto {
  @ApiProperty({ description: 'mfaToken of the confirmed enrollment' })
  @Allow()
  mfaToken: string;
}

export class MfaEnrollCompleteDto extends MfaDeviceFields {
  @ApiProperty({ description: 'mfaToken of the confirmed enrollment' })
  @Allow()
  mfaToken: string;
}

export class MfaVerifyDto extends MfaDeviceFields {
  @ApiProperty()
  @Allow()
  mfaToken: string;

  @ApiPropertyOptional({
    example: '123456',
    description:
      '6-digit authenticator code (send exactly one of code / backupCode)',
  })
  @Allow()
  code?: string;

  @ApiPropertyOptional({
    example: 'ABCDE-FGH23',
    description:
      'Single-use backup code (send exactly one of code / backupCode)',
  })
  @Allow()
  backupCode?: string;
}

export class RegenerateBackupCodesDto {
  @ApiProperty({ example: '123456', description: 'Current authenticator code' })
  @Allow()
  code: string;
}

export class MfaUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;
}

/** 201 body of POST /auth/login and POST /auth/exchange for a privileged user. */
export class MfaRequiredResponseDto {
  @ApiProperty({ enum: ['MFA_REQUIRED'], example: 'MFA_REQUIRED' })
  code: 'MFA_REQUIRED';

  @ApiProperty({ description: 'Opaque, single-use, valid for 5 minutes' })
  mfaToken: string;

  @ApiProperty({
    description:
      'true = first sign-in since becoming privileged: enroll an authenticator first',
  })
  enrollmentRequired: boolean;

  @ApiProperty({ type: MfaUserDto })
  user: MfaUserDto;
}

export class MfaEnrollStartResponseDto {
  @ApiProperty({
    example: 'otpauth://totp/PON:jane%40acme.com?secret=...&issuer=PON',
  })
  otpauthUrl: string;

  @ApiProperty({ description: 'Base32 secret for manual entry' })
  secret: string;

  @ApiProperty({
    description: 'QR code of otpauthUrl as a data:image/png;base64 URL',
  })
  qrDataUrl: string;
}

/** 201 body of enroll/confirm: enrolled, NO session yet (see enroll/complete). */
export class MfaEnrollConfirmResponseDto {
  @ApiProperty({
    enum: ['MFA_BACKUP_CODES_ISSUED'],
    example: 'MFA_BACKUP_CODES_ISSUED',
  })
  code: 'MFA_BACKUP_CODES_ISSUED';

  @ApiProperty({
    type: [String],
    example: ['ABCDE-FGH23'],
    description:
      '10 single-use backup codes (stored hashed). Re-readable via enroll/codes until enroll/complete, at most 10 minutes.',
  })
  backupCodes: string[];
}

export class MfaEnrollCodesResponseDto {
  @ApiProperty({
    type: [String],
    example: ['ABCDE-FGH23'],
    description: 'The same 10 backup codes enroll/confirm returned',
  })
  backupCodes: string[];
}

/** 201 body of enroll/complete: the login-success shape. */
export class MfaEnrollCompleteResponseDto extends LoginTokensResponseDto {}

export class MfaVerifyResponseDto extends LoginTokensResponseDto {
  @ApiProperty({ description: 'Unused backup codes left after this sign-in' })
  backupCodesRemaining: number;
}

export class BackupCodesResponseDto {
  @ApiProperty({
    type: [String],
    description:
      '10 new single-use backup codes (the old ones stop working). Shown once.',
  })
  backupCodes: string[];
}
