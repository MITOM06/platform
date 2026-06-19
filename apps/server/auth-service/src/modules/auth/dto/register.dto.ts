import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Public display name', minLength: 2 })
  @IsString()
  @IsNotEmpty({ message: AuthCode.VAL_DISPLAYNAME_REQUIRED })
  @MinLength(2, { message: AuthCode.VAL_DISPLAYNAME_TOO_SHORT })
  displayName: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email address (must be unique)' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'Account password', minLength: 8 })
  @IsString()
  @MinLength(8, { message: AuthCode.VAL_PASSWORD_TOO_SHORT })
  password: string;
}
