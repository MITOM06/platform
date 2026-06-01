import { Document } from 'mongoose';
export type FriendshipDocument = Friendship & Document;
export type FriendshipStatus = 'pending' | 'accepted';
export declare class Friendship {
    requesterId: string;
    recipientId: string;
    status: FriendshipStatus;
}
export declare const FriendshipSchema: import("mongoose").Schema<Friendship, import("mongoose").Model<Friendship, any, any, any, Document<unknown, any, Friendship> & Friendship & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Friendship, Document<unknown, {}, import("mongoose").FlatRecord<Friendship>> & import("mongoose").FlatRecord<Friendship> & {
    _id: import("mongoose").Types.ObjectId;
}>;
