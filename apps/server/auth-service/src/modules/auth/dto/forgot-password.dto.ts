import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email to send the reset OTP to' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  @IsNotEmpty({ message: AuthCode.VAL_EMAIL_REQUIRED })
  email: string;
}
