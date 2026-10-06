import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtUser } from '@platform/database';
import { SENSITIVE_THROTTLE } from '../auth/throttle';
import { SuccessResponseDto } from '../invitations/dto/invitation-view.dto';
import {
  BackupCodesResponseDto,
  RegenerateBackupCodesDto,
} from './dto/mfa.dto';
import { MfaAccountService } from './mfa-account.service';

/** Signed-in user: manage one's own 2FA. */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/users/me/mfa')
export class MfaSelfController {
  constructor(private readonly mfa: MfaAccountService) {}

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
}

/** Owner-only 2FA reset of another member (authorization in the service). */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/members')
export class MfaAdminController {
  constructor(private readonly mfa: MfaAccountService) {}

  @Post(':id/mfa/reset')
  @ApiOperation({
    summary: "Owner only: reset a member's 2FA and revoke their sessions",
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  reset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mfa.resetForMember(user.sub, user.role, id);
  }
}
