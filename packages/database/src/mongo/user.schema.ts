import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

export type UserDocument = User & Document;

@NestSchema({ _id: false })
class TrustedDevice {
  @Prop({ required: true })
  deviceId: string;

  @Prop()
  deviceName: string;

  @Prop({ default: Date.now })
  lastLoginAt: Date;
}

@NestSchema({ timestamps: true })
export class User {
  @Prop({ required: true })
  displayName: string;

  @Prop()
  avatarUrl: string;

  @Prop()
  bio: string;

  @Prop()
  coverPhoto: string;

  @Prop()
  dateOfBirth: Date;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  phoneNumber: string;

  @Prop({ select: false })
  password: string;

  @Prop({ default: [] })
  trustedDevices: TrustedDevice[];

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: Schema.Types.Mixed, default: {} })
  socialLinks: Record<string, string>;

  @Prop({ default: 'active' })
  status: 'active' | 'blocked' | 'pending';

  @Prop({ select: false })
  otpCode: string;

  @Prop({ select: false })
  otpExpires: Date;

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop()
  gender: string;

  @Prop({ default: false })
  hideInfo: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);