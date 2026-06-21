import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserBlock, UserBlockDocument } from '@platform/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  // ❌ Xóa: session: any;  — không cần nữa

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserBlock.name)
    private userBlockModel: Model<UserBlockDocument>,
    // ❌ Xóa: SessionService — UsersService không cần biết về session
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    // otpCode/otpExpires are select:false (never leak via /me or /search); the
    // OTP + login flows read them through this internal lookup only.
    return this.userModel
      .findOne({ email })
      .select('+password +otpCode +otpExpires')
      .exec();
  }

  async findByPhone(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ phoneNumber })
      .select('+password +otpCode +otpExpires')
      .exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).select('-password').exec();
    } catch (err: any) {
      // Mongoose throws CastError for non-ObjectId strings (e.g. 'ai-bot-…')
      if (err?.name === 'CastError') return null;
      throw err;
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { password: passwordHash },
      $unset: { otpCode: '', otpExpires: '' },
    });
  }

  async updateOtp(userId: any, otp: string, expires: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        otpCode: otp,
        otpExpires: expires,
      },
    });
  }

  async setVerified(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { isVerified: true },
      $unset: { otpCode: '', otpExpires: '' },
    });
  }

  // ✅ Query đúng với socialLinks pattern
  // provider = 'google' → query { 'socialLinks.google': socialId }
  async findBySocialId(
    provider: string,
    socialId: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ [`socialLinks.${provider}`]: socialId })
      .exec();
  }

  // ✅ Link hoặc update socialId cho user đã tồn tại
  // Dùng khi: user đăng nhập bằng email thường, sau đó link Google/Twitter
  async updateSocialId(
    userId: string,
    provider: string,
    socialId: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { [`socialLinks.${provider}`]: socialId },
    });
  }

  async findBySearchQuery(query: string): Promise<UserDocument[]> {
    const trimmed = (query ?? '').trim();
    // Empty query: trả về rỗng thay vì match-all (tránh leak toàn bộ user list)
    if (!trimmed) return [];
    // Escape regex metachars — email chứa '.', '+' và input '[' sẽ làm
    // new RegExp() throw (500) hoặc match sai nếu không escape.
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    return this.userModel
      .find({
        $or: [{ email: pattern }, { displayName: pattern }],
      })
      .limit(10)
      .select('-password')
      .exec();
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      coverPhoto?: string;
      dateOfBirth?: string;
      phoneNumber?: string;
      gender?: string;
      hideInfo?: boolean;
      showDateOfBirth?: boolean;
      showPhoneNumber?: boolean;
      showGender?: boolean;
    },
  ): Promise<UserDocument | null> {
    const updateData: any = {};
    if (data.displayName !== undefined)
      updateData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.coverPhoto !== undefined) updateData.coverPhoto = data.coverPhoto;
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : null;
    }
    if (data.phoneNumber !== undefined)
      updateData.phoneNumber = data.phoneNumber || null; // '' → null to satisfy sparse unique index
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.hideInfo !== undefined) updateData.hideInfo = data.hideInfo;
    if (data.showDateOfBirth !== undefined)
      updateData.showDateOfBirth = data.showDateOfBirth;
    if (data.showPhoneNumber !== undefined)
      updateData.showPhoneNumber = data.showPhoneNumber;
    if (data.showGender !== undefined)
      updateData.showGender = data.showGender;

    if (Object.keys(updateData).length > 0) {
      return this.userModel
        .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
        .select('-password')
        .exec();
    }
    return this.findById(userId);
  }

  async changePassword(
    userId: string,
    currentPassword?: string,
    newPassword?: string,
  ): Promise<{ success: boolean }> {
    if (!newPassword || newPassword.length < 6) {
      throw new ConflictException('New password must be at least 6 characters');
    }

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) {
      throw new ConflictException('User not found');
    }

    if (user.password) {
      if (!currentPassword) {
        throw new ConflictException('Current password is required');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new ConflictException('Incorrect current password');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await this.updatePassword(userId, hash);
    return { success: true };
  }

  async addDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: token },
    });
  }

  /** Record that `userId` blocks `targetId` (idempotent). */
  async blockUser(
    userId: string,
    targetId: string,
  ): Promise<{ success: true }> {
    if (userId === targetId) {
      throw new ConflictException('You cannot block yourself');
    }
    await this.userBlockModel.updateOne(
      { blockerId: userId, blockedId: targetId },
      { $setOnInsert: { blockerId: userId, blockedId: targetId } },
      { upsert: true },
    );
    return { success: true };
  }

  /** Remove the block from `userId` to `targetId`. */
  async unblockUser(
    userId: string,
    targetId: string,
  ): Promise<{ success: true }> {
    await this.userBlockModel
      .deleteOne({ blockerId: userId, blockedId: targetId })
      .exec();
    return { success: true };
  }

  /**
   * Block relationship between two users, from `userId`'s point of view:
   *   - `iBlocked`  — current user has blocked `otherId`
   *   - `blockedMe` — `otherId` has blocked the current user
   */
  async getBlockState(
    userId: string,
    otherId: string,
  ): Promise<{ iBlocked: boolean; blockedMe: boolean }> {
    const [iBlocked, blockedMe] = await Promise.all([
      this.userBlockModel.exists({ blockerId: userId, blockedId: otherId }),
      this.userBlockModel.exists({ blockerId: otherId, blockedId: userId }),
    ]);
    return {
      iBlocked: Boolean(iBlocked),
      blockedMe: Boolean(blockedMe),
    };
  }
}
