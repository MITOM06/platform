import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Session id issued at login' })
  @IsString()
  @IsNotEmpty()
  sid: string;

  @ApiProperty({ description: 'Opaque refresh token issued at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
