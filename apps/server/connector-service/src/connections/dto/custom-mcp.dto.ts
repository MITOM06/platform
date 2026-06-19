import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class DiscoverCustomMcpDto {
  @IsUrl({ require_tld: false })
  url: string;

  @IsIn(['oauth2', 'apikey', 'none'])
  authType: 'oauth2' | 'apikey' | 'none';

  @IsOptional()
  @IsString()
  credential?: string;
}

export class CreateCustomMcpDto extends DiscoverCustomMcpDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
