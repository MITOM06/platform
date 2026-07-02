import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  User,
  UserDocument,
  UserBlock,
  UserBlockDocument,
} from '@platform/database';
import * as bcrypt from 'bcrypt';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class UsersService {
  // ❌ Xóa: session: any;  — không cần nữa

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserBlock.name)
    private userBlockModel: Model<UserBlockDocument>,
    private readonly firebaseAdmin: FirebaseAdminService,
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
      return await this.userModel
        .findById(id)
        .select('-password')
        .populate('roleId', 'name isPreset')
        .exec();
    } catch (err: any) {
      // Mongoose throws CastError for non-ObjectId strings (e.g. 'ai-bot-…')
      if (err?.name === 'CastError') return null;
      throw err;
    }
  }

  /** Returns true if the user has set a local password (as opposed to being OAuth-only). */
  async getHasPassword(userId: string): Promise<boolean> {
    try {
      const doc = await this.userModel
        .findById(userId)
        .select('+password')
        .exec();
      return !!(doc as any)?.password;
    } catch {
      return false;
    }
  }

  /**
   * Batch lookup: resolve many ids in a SINGLE Mongo query. Mirrors
   * `findById`'s `-password` projection. Order of results is NOT guaranteed
   * to match the input order. Invalid (non-ObjectId) ids are silently skipped
   * — Mongoose casts the `$in` array and drops uncastable entries.
   */
  async findManyByIds(ids: string[]): Promise<UserDocument[]> {
    if (!ids || ids.length === 0) return [];
    try {
      return await this.userModel
        .find({ _id: { $in: ids } })
        .select('-password')
        .populate('roleId', 'name isPreset')
        .exec();
    } catch (err: any) {
      if (err?.name === 'CastError') return [];
      throw err;
    }
  }

  async setRoleAndDepartments(
    userId: string,
    roleId: string | null,
    departmentIds: string[],
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { roleId: roleId ?? null, departmentIds } },
      )
      .exec();
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

  /**
   * Search users by name/email (partial match) OR by phone number (exact only).
   *
   * - If the query looks like a phone number (only +, digits, separators, and
   *   ≥ 7 digits): exact match on the normalized E.164 `phoneNumber`. Only
   *   returns a user that is active AND has `phoneVerified` AND `showPhoneNumber`.
   *   Result is tagged `matchedBy: 'phone'` so the FE can highlight the number.
   *   Vietnamese local numbers (`0xxxxxxxxx`) are normalized to `+84xxxxxxxxx`.
   * - Otherwise: partial, case-insensitive match on `displayName`/`email`.
   *   `phoneNumber` is NEVER included in name/email results (privacy — must
   *   never leak someone else's phone via a name search).
   *
   * Returns no users for an empty query (avoid leaking the whole user list).
   */
  async findBySearchQuery(
    query: string,
  ): Promise<{ users: UserDocument[]; matchedBy: 'phone' | 'name_email' }> {
    const trimmed = (query ?? '').trim();
    if (!trimmed) return { users: [], matchedBy: 'name_email' };

    // Phone detection: only +, digits and separators, with ≥ 7 digits.
    const digitsOnly = trimmed.replace(/[\s\-().]/g, '');
    const isPhone = /^\+?\d{7,15}$/.test(digitsOnly);

    if (isPhone) {
      // Normalize to E.164. Vietnamese local `0xxxxxxxxx` → `+84xxxxxxxxx`.
      let e164 = digitsOnly;
      if (e164.startsWith('0')) e164 = '+84' + e164.slice(1);
      else if (!e164.startsWith('+')) e164 = '+' + e164;

      const user = await this.userModel
        .findOne({
          phoneNumber: e164,
          phoneVerified: true,
          showPhoneNumber: true,
          status: 'active',
        })
        .select('-trustedDevices -socialLinks -fcmTokens')
        .exec();

      return { users: user ? [user] : [], matchedBy: 'phone' };
    }

    // Name / email search (partial, case-insensitive). Escape regex metachars —
    // email contains '.', '+' and input '[' would make new RegExp() throw (500)
    // or match incorrectly if not escaped.
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    const users = await this.userModel
      .find({
        $or: [{ email: pattern }, { displayName: pattern }],
        status: 'active',
      })
      .limit(10)
      // phoneNumber excluded from name/email search → never leak another
      // user's phone via a name search.
      .select('-password -trustedDevices -socialLinks -fcmTokens -phoneNumber')
      .exec();

    return { users, matchedBy: 'name_email' };
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
    const updateData: Record<string, unknown> = {};
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
    if (data.phoneNumber !== undefined) {
      updateData.phoneNumber = data.phoneNumber || null; // '' → null to satisfy sparse unique index
      // Phone changed via the unverified PATCH path — always require re-verification.
      updateData.phoneVerified = false;
    }
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.hideInfo !== undefined) updateData.hideInfo = data.hideInfo;
    if (data.showDateOfBirth !== undefined)
      updateData.showDateOfBirth = data.showDateOfBirth;
    if (data.showPhoneNumber !== undefined)
      updateData.showPhoneNumber = data.showPhoneNumber;
    if (data.showGender !== undefined) updateData.showGender = data.showGender;

    if (Object.keys(updateData).length > 0) {
      return this.userModel
        .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
        .select('-password')
        .exec();
    }
    return this.findById(userId);
  }

  /**
   * Verifies a Firebase Phone Auth ID token.
   * The token is issued by Firebase after the user successfully enters the SMS OTP.
   * Extracts the phone number from the token's claims, checks for conflicts,
   * and persists phoneNumber + phoneVerified=true on the user document.
   */
  async verifyFirebasePhoneToken(
    userId: string,
    idToken: string,
  ): Promise<UserDocument> {
    let decoded: import('firebase-admin').auth.DecodedIdToken;
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(idToken);
    } catch {
      throw new BadRequestException({ code: 'PHONE_TOKEN_INVALID' });
    }

    const phone = decoded.phone_number;
    if (!phone) {
      throw new BadRequestException({ code: 'PHONE_TOKEN_NO_NUMBER' });
    }

    // Check for duplicate phone across other users.
    const conflict = await this.userModel.findOne({
      phoneNumber: phone,
      _id: { $ne: userId },
    });
    if (conflict)
      throw new BadRequestException({ code: 'PHONE_ALREADY_TAKEN' });

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { phoneNumber: phone, phoneVerified: true } },
        { new: true },
      )
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
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
   * Returns true if `ownerId` has blocked `callerId`.
   * Used to enforce profile privacy: if the profile owner has blocked the
   * caller, the caller sees only a minimal public view.
   */
  async isBlockedBy(ownerId: string, callerId: string): Promise<boolean> {
    const exists = await this.userBlockModel.exists({
      blockerId: ownerId,
      blockedId: callerId,
    });
    return !!exists;
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
