import { Document, Schema } from 'mongoose';
export type UserDocument = User & Document;
declare class TrustedDevice {
    deviceId: string;
    deviceName: string;
    lastLoginAt: Date;
}
export declare class User {
    displayName: string;
    avatarUrl: string;
    bio: string;
    coverPhoto: string;
    dateOfBirth: Date;
    email: string;
    phoneNumber: string;
    password: string;
    trustedDevices: TrustedDevice[];
    isVerified: boolean;
    socialLinks: Record<string, string>;
    status: 'active' | 'blocked' | 'pending';
    otpCode: string;
    otpExpires: Date;
    fcmTokens: string[];
    gender: string;
    hideInfo: boolean;
}
export declare const UserSchema: Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User> & User & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>> & import("mongoose").FlatRecord<User> & {
    _id: import("mongoose").Types.ObjectId;
}>;
export {};
