import { Document } from 'mongoose';
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
    googleId: string;
    facebookId: string;
    twitterId: string;
    status: 'active' | 'blocked' | 'pending';
    otpCode: string;
    otpExpires: Date;
}
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User> & User & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>> & import("mongoose").FlatRecord<User> & {
    _id: import("mongoose").Types.ObjectId;
}>;
export {};
