import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const INVITATION_STATUSES = [
  'pending',
  'expired',
  'accepted',
  'revoked',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
export const INVITATION_STATUS_FILTERS = [
  ...INVITATION_STATUSES,
  'all',
] as const;
export type InvitationStatusFilter = (typeof INVITATION_STATUS_FILTERS)[number];

export class InvitationInviterDto {
  @ApiProperty({
    description: 'Inviter user id, or "system" for the boot-time Owner invite',
  })
  id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Inviter display name (workspace name for "system"); null if the inviter no longer exists',
  })
  displayName: string | null;
}

/** Admin list/create/resend item. NEVER contains the token or its hash. */
export class InvitationViewDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ example: 'jane@acme.com' })
  email: string;

  @ApiProperty()
  roleId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null if the role was deleted',
  })
  roleName: string | null;

  @ApiProperty({ type: [String] })
  departmentIds: string[];

  @ApiProperty({ type: InvitationInviterDto })
  invitedBy: InvitationInviterDto;

  @ApiProperty({ enum: INVITATION_STATUSES })
  status: InvitationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastSentAt: string;

  @ApiProperty()
  sendCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acceptedAt: string | null;

  @ApiProperty({
    type: String,
    enum: ['password', 'google', 'oidc'],
    nullable: true,
  })
  acceptedVia: 'password' | 'google' | 'oidc' | null;
}

export class InvitationMutationResponseDto {
  @ApiProperty({ type: InvitationViewDto })
  invitation: InvitationViewDto;

  @ApiProperty({
    description:
      'false when the invitation was saved but the email could not be sent',
  })
  emailSent: boolean;
}

/** Public preview shown on the accept page. */
export class InvitationPreviewDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  workspaceName: string;

  @ApiProperty()
  inviterName: string;

  @ApiProperty({ type: String, nullable: true })
  roleName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: string;
}

export class ListInvitationsQueryDto {
  @ApiPropertyOptional({
    enum: INVITATION_STATUS_FILTERS,
    description: 'Default (omitted) = pending + expired',
  })
  @IsOptional()
  @IsIn(INVITATION_STATUS_FILTERS as unknown as string[])
  status?: InvitationStatusFilter;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

/** LoginTokens returned by accept-password (same shape as POST /auth/login). */
export class LoginTokensUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;
}

export class LoginTokensResponseDto {
  @ApiProperty({ example: 'INVITATION_ACCEPTED' })
  code: string;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  sid: string;

  @ApiProperty({ type: LoginTokensUserDto })
  user: LoginTokensUserDto;
}
