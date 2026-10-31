import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@platform/database';

/** Reads how many unused 2FA backup codes a member has left, for their own `/me`. */
@Injectable()
export class BackupCodesCountService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * The hashes are select:false and are read here only to be counted: they
   * never leave this method. `undefined` when unknown, so a failed read can't
   * look like "0 left".
   */
  async remaining(userId: string): Promise<number | undefined> {
    try {
      const doc = await this.userModel
        .findById(userId)
        .select('mfa.backupCodeHashes')
        .lean()
        .exec();
      if (!doc) return undefined;
      return doc.mfa?.backupCodeHashes?.length ?? 0;
    } catch {
      return undefined;
    }
  }
}
