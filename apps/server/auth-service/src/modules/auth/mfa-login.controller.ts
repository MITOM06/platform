import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthCode } from '../../common/auth-code.enum';
import {
  MfaEnrollCodesDto,
  MfaEnrollCodesResponseDto,
  MfaEnrollCompleteDto,
  MfaEnrollCompleteResponseDto,
  MfaEnrollConfirmDto,
  MfaEnrollConfirmResponseDto,
  MfaEnrollStartDto,
  MfaEnrollStartResponseDto,
  MfaVerifyDto,
  MfaVerifyResponseDto,
} from '../mfa/dto/mfa.dto';
import { MfaService } from '../mfa/mfa.service';
import { AuthService } from './auth.service';
import { SENSITIVE_THROTTLE } from './throttle';

/**
 * Public (no JWT) second step of a privileged sign-in. The mfaToken from the
 * MFA_REQUIRED answer of /auth/login or /auth/exchange is the only credential.
 * A session is issued only by verify, or by enroll/complete once the backup
 * codes from enroll/confirm were acknowledged (so they cannot be skipped).
 */
@ApiTags('auth')
@Controller('auth/mfa')
export class MfaLoginController {
  constructor(
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
  ) {}

  @Post('enroll/start')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Start authenticator enrollment (QR + manual key)' })
  @ApiCreatedResponse({ type: MfaEnrollStartResponseDto })
  enrollStart(@Body() dto: MfaEnrollStartDto) {
    return this.mfa.enrollStart(dto.mfaToken);
  }

  @Post('enroll/confirm')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'Confirm enrollment with one code; returns the backup codes, NO session yet',
  })
  @ApiCreatedResponse({ type: MfaEnrollConfirmResponseDto })
  @ApiResponse({
    status: 401,
    description: 'MFA_TOKEN_INVALID / MFA_CODE_INVALID / MFA_TOO_MANY_ATTEMPTS',
  })
  async enrollConfirm(@Body() dto: MfaEnrollConfirmDto) {
    const { backupCodes } = await this.mfa.enrollConfirm(dto);
    return { code: AuthCode.MFA_BACKUP_CODES_ISSUED, backupCodes };
  }

  @Post('enroll/codes')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'The backup codes of a confirmed enrollment again (after a reload)',
  })
  @ApiCreatedResponse({ type: MfaEnrollCodesResponseDto })
  @ApiResponse({ status: 400, description: 'MFA_NOT_ENROLLED (wrong step)' })
  @ApiResponse({ status: 401, description: 'MFA_TOKEN_INVALID' })
  enrollCodes(@Body() dto: MfaEnrollCodesDto) {
    return this.mfa.enrollCodes(dto.mfaToken);
  }

  @Post('enroll/complete')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Backup codes saved: finish enrollment and sign in (single use)',
  })
  @ApiCreatedResponse({ type: MfaEnrollCompleteResponseDto })
  @ApiResponse({ status: 400, description: 'MFA_NOT_ENROLLED (wrong step)' })
  @ApiResponse({ status: 401, description: 'MFA_TOKEN_INVALID' })
  async enrollComplete(@Body() dto: MfaEnrollCompleteDto) {
    const { user, deviceId, platform } = await this.mfa.enrollComplete(dto);
    const tokens = await this.auth.issueTokensForUser(user, deviceId, platform);
    return { code: AuthCode.LOGIN_SUCCESS, ...tokens };
  }

  @Post('verify')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Verify a TOTP or backup code; signs in' })
  @ApiCreatedResponse({ type: MfaVerifyResponseDto })
  @ApiResponse({
    status: 401,
    description: 'MFA_TOKEN_INVALID / MFA_CODE_INVALID / MFA_TOO_MANY_ATTEMPTS',
  })
  async verify(@Body() dto: MfaVerifyDto) {
    const { user, deviceId, platform, backupCodesRemaining } =
      await this.mfa.verify(dto);
    const tokens = await this.auth.issueTokensForUser(user, deviceId, platform);
    return { code: AuthCode.LOGIN_SUCCESS, ...tokens, backupCodesRemaining };
  }
}
