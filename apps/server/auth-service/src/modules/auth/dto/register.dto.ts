import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthCode } from '../../../common/auth-code.enum';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: AuthCode.VAL_DISPLAYNAME_REQUIRED })
  @MinLength(2, { message: AuthCode.VAL_DISPLAYNAME_TOO_SHORT })
  displayName: string;

  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @IsString()
  @MinLength(8, { message: AuthCode.VAL_PASSWORD_TOO_SHORT })
  password: string;
}
