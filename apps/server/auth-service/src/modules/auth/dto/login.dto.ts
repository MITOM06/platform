import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Registered email address' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'Account password', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  password: string;
}
