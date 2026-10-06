import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';
import { MIN_PASSWORD_LENGTH } from '../../../common/password-policy';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email of the account to reset' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: '123456', description: 'Verified OTP code' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ example: 'N3wP@ssw0rd', description: 'New password', minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: AuthCode.VAL_PASSWORD_TOO_SHORT })
  password: string;
}
