import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email of the account to reset' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: '123456', description: 'Verified OTP code' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ example: 'N3wP@ssw0rd', description: 'New password', minLength: 8 })
  @IsString()
  @MinLength(8, { message: AuthCode.VAL_PASSWORD_TOO_SHORT })
  password: string;
}
