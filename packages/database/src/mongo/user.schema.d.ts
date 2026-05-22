import { Document, Schema } from 'mongoose';
export type UserDocument = User & Document;
declare class TrustedDevice {
    deviceId: string;
    deviceName: string;
    lastLoginAt: Date;
}
export declare class User {
    displayName: string;
    avatar: string;
    email: string;
    phoneNumber: string;
    password: string;
    trustedDevices: TrustedDevice[];
    isVerified: boolean;
    socialLinks: Record<string, string>;
    status: 'active' | 'blocked' | 'pending';
    otpCode: string;
    otpExpires: Date;
}
export declare const UserSchema: Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User, any, {}> & User & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<User> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
export {};
