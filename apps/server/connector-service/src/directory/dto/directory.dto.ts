import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  DirectoryAuthMode,
  DirectoryTier,
} from '../../connections/schemas/mcp-directory-entry.schema';
import { CLIENT_ID_ENV_PATTERN, CLIENT_SECRET_ENV_PATTERN } from '../env-oauth-policy';

// Syntax only; the env-aware SSRF guard (https in production, public hosts)
// runs in DirectoryService because it needs DNS.
const URL_OPTS = { protocols: ['https', 'http'], require_protocol: true, require_tld: false };
const ENV_ID_MSG = 'envClientIdName must be OAUTH_<NAME>_CLIENT_ID (or GOOGLE_/NOTION_CLIENT_ID)';
const ENV_SECRET_MSG =
  'envClientSecretName must be OAUTH_<NAME>_CLIENT_SECRET (or GOOGLE_/NOTION_CLIENT_SECRET)';

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
  // Becomes the tool-name provider segment (`mcp__<slug>__<tool>`, 64 chars
  // max overall), so it is length-capped to leave room for the tool part.
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
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
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
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
  @Matches(CLIENT_ID_ENV_PATTERN, { message: ENV_ID_MSG })
  envClientIdName?: string;

  @IsOptional()
  @IsString()
  @Matches(CLIENT_SECRET_ENV_PATTERN, { message: ENV_SECRET_MSG })
  envClientSecretName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
  authorizeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
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
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
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
  @Matches(CLIENT_ID_ENV_PATTERN, { message: ENV_ID_MSG })
  envClientIdName?: string;

  @IsOptional()
  @IsString()
  @Matches(CLIENT_SECRET_ENV_PATTERN, { message: ENV_SECRET_MSG })
  envClientSecretName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
  authorizeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(URL_OPTS)
  tokenUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
