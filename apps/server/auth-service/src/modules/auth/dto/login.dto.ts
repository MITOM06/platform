import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthCode } from '../../../common/auth-code.enum';

export class LoginDto {
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
