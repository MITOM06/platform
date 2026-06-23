import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSkill, UserSkillSchema } from './user-skill.schema';
import { SkillsService } from './skills.service';

const skillFeature = MongooseModule.forFeature([
  { name: UserSkill.name, schema: UserSkillSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [skillFeature],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
