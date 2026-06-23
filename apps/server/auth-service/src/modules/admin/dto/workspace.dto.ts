import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VALID_TONES = ['friendly', 'professional', 'concise', 'creative'] as const;
const VALID_MODEL_TIERS = ['auto', 'simple', 'mid', 'complex'] as const;

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

/**
 * AI assistant defaults (TASK-12). EVERY field is optional AND nullable, where
 * `null` = "inherit the ai-service env default" (explicit fallback contract).
 * `@IsOptional()` permits both `null` and absent; the typed validator only runs
 * on a non-null value.
 */
export class WorkspaceAiSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  personaName?: string | null;

  @ApiPropertyOptional({ enum: VALID_TONES, nullable: true })
  @IsOptional()
  @IsIn(VALID_TONES)
  defaultTone?: string | null;

  @ApiPropertyOptional({ enum: VALID_MODEL_TIERS, nullable: true })
  @IsOptional()
  @IsIn(VALID_MODEL_TIERS)
  modelTier?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  webSearchEnabled?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  thinkingEnabled?: boolean | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTokenLimit?: number | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description:
      'AI-specific MCP connector allow-list (catalog ids). null = inherit ' +
      'connectorAllowList; [] = allow none; must be a subset of connectorAllowList.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedConnectors?: string[] | null;

  /**
   * Daily-digest opt-in (TASK-11). `null` ⇒ inherit ai-service env
   * AI_DIGEST_ENABLED (default false).
   */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean | null;

  /**
   * Local hour 0–23 to deliver the daily digest (TASK-11). `null` ⇒ inherit
   * ai-service env AI_DIGEST_HOUR (default 8).
   */
  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dailyDigestHour?: number | null;
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

  @ApiPropertyOptional({ description: 'AI assistant defaults (TASK-12)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceAiSettingsDto)
  aiSettings?: WorkspaceAiSettingsDto;
}
