import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SetSkillDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  skillId: string;

  @IsBoolean()
  enabled: boolean;
}

export interface SkillView {
  skillId: string;
  enabled: boolean;
}
