import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtUser } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { SENSITIVE_THROTTLE } from '../auth/throttle';
import { SuccessResponseDto } from '../invitations/dto/invitation-view.dto';
import {
  BackupCodesResponseDto,
  MfaDisableDto,
  MfaEnrollStartResponseDto,
  MfaSelfEnrollConfirmDto,
  MfaSelfEnrollConfirmResponseDto,
  RegenerateBackupCodesDto,
} from './dto/mfa.dto';
import { MfaAccountService } from './mfa-account.service';
import { MfaSelfService } from './mfa-self.service';

const SSO_REQUIRED_RESPONSE = {
  status: 403,
  description:
    'SSO_REQUIRED: the workspace requires SSO for this member (no PON 2FA)',
};

/**
 * Signed-in user: manage one's own 2FA. Never answers 401 for a wrong code
 * (clients would refresh, then log out); no session is created or revoked.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/users/me/mfa')
export class MfaSelfController {
  constructor(
    private readonly mfa: MfaAccountService,
    private readonly self: MfaSelfService,
  ) {}

  @Post('backup-codes')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Replace the backup codes (needs the current authenticator code)',
  })
  @ApiCreatedResponse({ type: BackupCodesResponseDto })
  regenerateBackupCodes(
    @CurrentUser() user: JwtUser,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    return this.mfa.regenerateBackupCodes(user.sub, dto.code);
  }

  @Post('enroll/start')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'Turn 2FA on from Settings: QR + manual key of a pending secret (10 minutes, the same one on every call)',
  })
  @ApiCreatedResponse({ type: MfaEnrollStartResponseDto })
  @ApiResponse({ status: 400, description: 'MFA_ALREADY_ENROLLED' })
  @ApiResponse(SSO_REQUIRED_RESPONSE)
  enrollStart(@CurrentUser() user: JwtUser) {
    return this.self.enrollStart(user.sub);
  }

  @Post('enroll/confirm')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'Confirm the Settings enrollment with one code; returns the backup codes once (session unchanged)',
  })
  @ApiCreatedResponse({ type: MfaSelfEnrollConfirmResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'MFA_CODE_INVALID (params.remaining) / MFA_TOO_MANY_ATTEMPTS / MFA_NOT_ENROLLED (no pending secret: start again) / MFA_ALREADY_ENROLLED',
  })
  @ApiResponse(SSO_REQUIRED_RESPONSE)
  async enrollConfirm(
    @CurrentUser() user: JwtUser,
    @Body() dto: MfaSelfEnrollConfirmDto,
  ) {
    const { backupCodes } = await this.self.enrollConfirm(user.sub, dto.code);
    return { code: AuthCode.MFA_BACKUP_CODES_ISSUED, backupCodes };
  }

  @Post('disable')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'Turn optional 2FA off (a current authenticator code or an unused backup code)',
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'MFA_REQUIRED_BY_ROLE (Owner / Admin-like) / MFA_NOT_ENROLLED / MFA_CODE_INVALID (params.remaining) / MFA_TOO_MANY_ATTEMPTS',
  })
  @ApiResponse(SSO_REQUIRED_RESPONSE)
  disable(@CurrentUser() user: JwtUser, @Body() dto: MfaDisableDto) {
    return this.self.disable(user.sub, {
      code: dto.code,
      backupCode: dto.backupCode,
    });
  }
}

/** 2FA reset of another member (authorization in the service). */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/members')
export class MfaAdminController {
  constructor(private readonly mfa: MfaAccountService) {}

  @Post(':id/mfa/reset')
  @ApiOperation({
    summary:
      "Reset a member's 2FA and revoke their sessions (Owner: anyone else; MANAGE_MEMBERS: non-admin members)",
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  reset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mfa.resetForMember(user, id);
  }
}
