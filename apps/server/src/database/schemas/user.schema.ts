import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true }) email!: string;
  @Prop({ required: true }) passwordHash!: string;
  @Prop() displayName?: string;
  @Prop() avatarUrl?: string;
  @Prop({ default: 'offline' }) status?: 'online'|'offline'|'busy';
}
export const UserSchema = SchemaFactory.createForClass(User);
