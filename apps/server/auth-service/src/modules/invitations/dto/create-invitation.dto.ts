import { IsArray, IsEmail, IsIn, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthCode } from '../../../common/auth-code.enum';
import { SUPPORTED_LOCALES } from '../../Email/otp-i18n';

export class CreateInvitationDto {
  @ApiProperty({ example: 'jane@acme.com', description: 'Email to invite' })
  @IsEmail({}, { message: AuthCode.VAL_EMAIL_INVALID })
  email: string;

  @ApiPropertyOptional({
    description: 'Role to grant on accept. Defaults to the preset Member role.',
  })
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Initial departments' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description:
      'Invitation email language. Defaults to the Accept-Language of the request.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES as unknown as string[])
  locale?: (typeof SUPPORTED_LOCALES)[number];
}
