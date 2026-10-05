import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';
import { MIN_PASSWORD_LENGTH } from '../../../common/password-policy';

export class AcceptInvitationPasswordDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: AuthCode.VAL_DISPLAYNAME_REQUIRED })
  @MinLength(2, { message: AuthCode.VAL_DISPLAYNAME_TOO_SHORT })
  @MaxLength(50)
  displayName: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: AuthCode.VAL_PASSWORD_TOO_SHORT })
  password: string;

  @ApiPropertyOptional({
    description: 'Device identifier for the issued session',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: ['web', 'mobile'], example: 'web' })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  platform?: 'web' | 'mobile';
}
