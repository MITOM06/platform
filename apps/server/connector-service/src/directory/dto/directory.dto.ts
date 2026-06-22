import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  DirectoryAuthMode,
  DirectoryTier,
} from '../../connections/schemas/mcp-directory-entry.schema';

const AUTH_MODES: DirectoryAuthMode[] = [
  'mcp-oauth',
  'env-oauth',
  'apikey',
  'none',
];
const TIERS: DirectoryTier[] = ['workspace', 'personal', 'both'];

/**
 * Public, client-safe view of a directory entry. Drops the env secret names
 * (envClientIdName / envClientSecretName) and the token/authorize endpoints —
 * clients only need to render the card and start the connect flow by slug.
 */
export interface DirectoryEntryView {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  mcpUrl: string;
  authMode: DirectoryAuthMode;
  tier: DirectoryTier;
  scopes: string[];
  available: boolean;
  builtin: boolean;
}

export class CreateDirectoryEntryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug must be lowercase alphanumeric/hyphen',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  mcpUrl: string;

  @IsIn(AUTH_MODES)
  authMode: DirectoryAuthMode;

  @IsOptional()
  @IsIn(TIERS)
  tier?: DirectoryTier;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  envClientIdName?: string;

  @IsOptional()
  @IsString()
  envClientSecretName?: string;

  @IsOptional()
  @IsString()
  authorizeUrl?: string;

  @IsOptional()
  @IsString()
  tokenUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class ConnectKeyDto {
  @IsString()
  @IsNotEmpty()
  credential: string;
}

export class UpdateDirectoryEntryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mcpUrl?: string;

  @IsOptional()
  @IsIn(AUTH_MODES)
  authMode?: DirectoryAuthMode;

  @IsOptional()
  @IsIn(TIERS)
  tier?: DirectoryTier;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  envClientIdName?: string;

  @IsOptional()
  @IsString()
  envClientSecretName?: string;

  @IsOptional()
  @IsString()
  authorizeUrl?: string;

  @IsOptional()
  @IsString()
  tokenUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
