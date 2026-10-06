import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CustomMcpAuthType } from '../schemas/custom-mcp-server.schema';

export class DiscoverCustomMcpDto {
  // Syntax only; the env-aware SSRF guard (https in production, public hosts
  // only, no `http://chat-service:8080`) runs in CustomMcpService.
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
  url: string;

  @IsIn(['oauth2', 'apikey', 'none'])
  authType: CustomMcpAuthType;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  credential?: string;
}

export class CreateCustomMcpDto extends DiscoverCustomMcpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

/**
 * Secret-free view of a custom MCP server (GET/POST /custom-mcp). Never carries
 * `encryptedCredential`; `url` is display-redacted because custom MCP URLs
 * often embed the API key (userinfo, query string or a path segment).
 */
export interface CustomMcpView {
  id: string;
  name: string;
  url: string;
  authType: CustomMcpAuthType;
  hasCredential: boolean;
  toolsPreview: { name: string; description: string }[];
  createdAt?: Date;
}
