import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthCode } from '../../common/auth-code.enum';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { AcceptInvitationPasswordDto } from '../invitations/dto/accept-invitation.dto';
import {
  InvitationPreviewDto,
  LoginTokensResponseDto,
} from '../invitations/dto/invitation-view.dto';
import { AuthService } from './auth.service';
import { SENSITIVE_THROTTLE } from './throttle';

/** Public (no JWT) invitation endpoints used by the invite accept page. */
@ApiTags('auth')
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

  @Post(':token/accept-password')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Accept an invitation by choosing a display name + password',
  })
  @ApiCreatedResponse({ type: LoginTokensResponseDto })
  async acceptPassword(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationPasswordDto,
  ) {
    const user = await this.invitations.acceptWithPassword(token, dto);
    const tokens = await this.auth.issueTokensForUser(
      user,
      dto.deviceId ?? 'web-login',
      dto.platform ?? 'web',
    );
    return { ...tokens, code: AuthCode.INVITATION_ACCEPTED };
  }
}
