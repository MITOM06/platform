import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email to resend the OTP to' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;
}
