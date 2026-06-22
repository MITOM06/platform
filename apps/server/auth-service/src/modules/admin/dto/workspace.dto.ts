import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceSsoDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  @IsObject()
  groupRoleMap?: Record<string, string>;

  @IsOptional()
  @IsObject()
  groupDeptMap?: Record<string, string>;

  @IsOptional()
  @IsString()
  defaultRole?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#00e5ff' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'feature flag map' })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional({
    type: [String],
    description: 'catalog connector ids members may personally connect',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectorAllowList?: string[];

  @ApiPropertyOptional({ description: 'SSO (OIDC) mapping config' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceSsoDto)
  sso?: WorkspaceSsoDto;
}
