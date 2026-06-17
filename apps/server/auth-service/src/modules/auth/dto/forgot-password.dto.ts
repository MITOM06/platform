import { IsEmail, IsNotEmpty } from 'class-validator';
import { AuthCode } from '../../../common/auth-code.enum';

export class ForgotPasswordDto {
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  @IsNotEmpty({ message: AuthCode.VAL_EMAIL_REQUIRED })
  email: string;
}
