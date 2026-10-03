import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Capability, CurrentUser, JwtUser } from '@platform/database';
import {
  RequirePermission,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { normalizeLocale } from '../Email/otp-i18n';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  InvitationMutationResponseDto,
  InvitationViewDto,
  ListInvitationsQueryDto,
  SuccessResponseDto,
} from './dto/invitation-view.dto';

/** Admin invitation management (invite-only onboarding). MANAGE_MEMBERS on every route. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RequirePermissionGuard)
@Controller('admin/invitations')
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'Invite an email (sends the invitation email)' })
  @ApiCreatedResponse({ type: InvitationMutationResponseDto })
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInvitationDto,
    @Headers('accept-language') acceptLang?: string,
  ) {
    return this.invitations.create(user, dto, normalizeLocale(acceptLang));
  }

  @Get()
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'List invitations (default: pending + expired)' })
  @ApiOkResponse({ type: [InvitationViewDto] })
  list(@Query() query: ListInvitationsQueryDto) {
    return this.invitations.list(query.status);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({
    summary: 'Rotate the token, reset expiry and resend the email',
  })
  @ApiOkResponse({ type: InvitationMutationResponseDto })
  resend(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.invitations.resend(user, id);
  }

  @Delete(':id')
  @RequirePermission(Capability.MANAGE_MEMBERS)
  @ApiOperation({ summary: 'Revoke a pending/expired invitation' })
  @ApiOkResponse({ type: SuccessResponseDto })
  revoke(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.invitations.revoke(user, id);
  }
}
