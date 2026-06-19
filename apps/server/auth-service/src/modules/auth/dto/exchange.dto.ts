import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExchangeDto {
  @ApiProperty({ description: 'One-time login code returned by the OAuth/login flow' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Device identifier for the issued session' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Originating platform', example: 'web' })
  @IsOptional()
  @IsString()
  platform?: string;
}
