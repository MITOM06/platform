import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
