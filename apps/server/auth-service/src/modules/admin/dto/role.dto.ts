import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Capability, PermissionMatrix } from '@platform/database';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'capability key -> enabled flag',
    example: { [Capability.USE_PERSONAL_ASSISTANT]: true },
  })
  @IsOptional()
  @IsObject()
  permissions?: PermissionMatrix;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'capability key -> enabled flag' })
  @IsOptional()
  @IsObject()
  permissions?: PermissionMatrix;
}

export class WorkspaceFeatureToggleDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
