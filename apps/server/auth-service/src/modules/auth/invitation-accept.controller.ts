import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { AcceptInvitationPasswordDto } from '../invitations/dto/accept-invitation.dto';
import {
  InvitationPreviewDto,
  LoginTokensResponseDto,
} from '../invitations/dto/invitation-view.dto';
import { MfaRequiredResponseDto } from '../mfa/dto/mfa.dto';
import { AuthService } from './auth.service';
import { SENSITIVE_THROTTLE } from './throttle';

/** Public (no JWT) invitation endpoints used by the invite accept page. */
@ApiTags('auth')
@ApiExtraModels(LoginTokensResponseDto, MfaRequiredResponseDto)
@Controller('auth/invitations')
export class InvitationAcceptController {
  constructor(
    private readonly invitations: InvitationAcceptService,
    private readonly auth: AuthService,
  ) {}

  @Get(':token')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({ summary: 'Preview an invitation (accept page)' })
  @ApiOkResponse({ type: InvitationPreviewDto })
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  /**
   * Creates the account, then answers like a password login: an Owner /
   * Admin-like invite role gets MFA_REQUIRED (enrollment; the session comes
   * from /auth/mfa/enroll/complete), any other role LOGIN_SUCCESS + tokens.
   */
  @Post(':token/accept-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary:
      'Accept an invitation by choosing a display name + password; Owner / Admin-like roles continue with 2FA enrollment',
  })
  @ApiResponse({
    status: 201,
    description:
      'LOGIN_SUCCESS + tokens (Member / non-admin role), or MFA_REQUIRED with enrollmentRequired: true (Owner / Admin-like role)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginTokensResponseDto) },
        { $ref: getSchemaPath(MfaRequiredResponseDto) },
      ],
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'SSO_REQUIRED: the workspace requires SSO for this email domain',
  })
  async acceptPassword(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationPasswordDto,
  ) {
    const user = await this.invitations.acceptWithPassword(token, dto);
    return this.auth.startSignIn(user, {
      deviceId: dto.deviceId ?? 'web-login',
      platform: dto.platform ?? 'web',
      method: 'invite',
    });
  }
}
