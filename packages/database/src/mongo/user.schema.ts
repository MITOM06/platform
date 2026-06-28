import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema, Types } from 'mongoose';

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

  @Prop({ default: false })
  phoneVerified: boolean;

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

  // Per-field privacy toggles ("show to others"). default true = public.
  // When absent on legacy docs, code falls back to `!hideInfo`.
  @Prop({ default: true })
  showDateOfBirth: boolean;

  @Prop({ default: true })
  showPhoneNumber: boolean;

  @Prop({ default: true })
  showGender: boolean;

  // ===================== ENTERPRISE RBAC MEMBERSHIP =====================
  // Single-workspace-per-deployment: membership is embedded on the user (no
  // separate Membership collection, no cross-company orgId).

  /** The user's assigned role (ref to a Role doc). Unassigned => treated as Member. */
  @Prop({ type: Schema.Types.ObjectId })
  roleId?: Types.ObjectId;

  /** Departments this user belongs to (refs to Department docs). */
  @Prop({ type: [Schema.Types.ObjectId], default: [] })
  departmentIds: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);