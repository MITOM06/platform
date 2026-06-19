import { Document } from 'mongoose';
export type UserBlockDocument = UserBlock & Document;
export declare class UserBlock {
    blockerId: string;
    blockedId: string;
}
export declare const UserBlockSchema: import("mongoose").Schema<UserBlock, import("mongoose").Model<UserBlock, any, any, any, Document<unknown, any, UserBlock> & UserBlock & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserBlock, Document<unknown, {}, import("mongoose").FlatRecord<UserBlock>> & import("mongoose").FlatRecord<UserBlock> & {
    _id: import("mongoose").Types.ObjectId;
}>;
