import { ApiProperty } from '@nestjs/swagger';

/** GET /auth/sso/info (public). */
export class SsoInfoResponseDto {
  @ApiProperty({ description: 'Show the "Sign in with SSO" button' })
  enabled: boolean;

  @ApiProperty({
    description:
      'The workspace requires SSO for its domains (password / Google sign-in are refused there, Owners excepted)',
  })
  enforced: boolean;

  @ApiProperty({ type: String, nullable: true, example: '/auth/oidc/login' })
  loginUrl: string | null;

  @ApiProperty({ example: 'Sign in with SSO' })
  buttonLabel: string;
}
