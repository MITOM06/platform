import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserSkillDocument = HydratedDocument<UserSkill>;

/**
 * Per-user skill enablement. Schema created in P1; fully wired by the
 * skills screens (web C3 / Flutter D3) via GET/PUT /skills.
 */
@Schema({ collection: 'user_skills', timestamps: true })
export class UserSkill {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  skillId: string;

  @Prop({ required: true, default: false })
  enabled: boolean;
}

export const UserSkillSchema = SchemaFactory.createForClass(UserSkill);

UserSkillSchema.index({ userId: 1, skillId: 1 }, { unique: true });
