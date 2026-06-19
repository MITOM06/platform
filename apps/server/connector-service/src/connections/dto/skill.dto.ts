import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

/** userId is derived from the JWT (`req.user.sub`), never accepted from the client. */
export class SetSkillDto {
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
