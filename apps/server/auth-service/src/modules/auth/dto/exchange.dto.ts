import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExchangeDto {
  @ApiProperty({ description: 'One-time login code returned by the OAuth/login flow' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Device identifier for the issued session' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Originating platform', example: 'web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

/** `user` of POST /auth/exchange. */
export class ExchangeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty({
    description:
      'true only for an account created by accepting an invitation with Google: the client must show "create your PON password" before the app',
  })
  mustSetPassword: boolean;
}

export class ExchangeResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  sid: string;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: ExchangeUserDto })
  user: ExchangeUserDto;
}
