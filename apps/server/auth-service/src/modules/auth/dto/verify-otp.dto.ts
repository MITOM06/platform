import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email the OTP was sent to' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: '123456', description: 'One-time code from the email' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
