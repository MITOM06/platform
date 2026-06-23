import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserSkillDocument = HydratedDocument<UserSkill>;

/**
 * Read model over the SHARED `user_skills` collection (written by
 * connector-service's GET/PUT /skills). ai-service only reads enablement here to
 * decide which skill instruction blocks to inject into the system prompt — it
 * never writes. Same Mongo database as every other service.
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
