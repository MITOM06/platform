import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
class TrustedDevice {
  @Prop({ required: true })
  deviceId: string;

  @Prop()
  deviceName: string;

  @Prop({ default: Date.now })
  lastLoginAt: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  displayName: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  phoneNumber: string;

  @Prop({ select: false }) // Ẩn mật khẩu khi query
  password: string;

  @Prop({ default: [] })
  trustedDevices: TrustedDevice[];

  @Prop({ default: false })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);