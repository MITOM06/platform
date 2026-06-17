import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  sid: string;

  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
