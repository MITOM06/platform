import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  Role,
  RoleDocument,
  User,
  UserDocument,
  UserBlock,
  UserBlockDocument,
} from '@platform/database';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { FriendsService } from '../friends/friends.service';
import { AuthCode } from '../../common/auth-code.enum';
import { escapeRegex, normalizeEmail } from '../../common/email';
import { isObjectIdString } from '../../common/ids';

/** select:false secrets the login / OTP flows (and only they) need. */
const AUTH_SECRET_FIELDS = '+password +otpCode +otpExpires';

/** Role + department membership as plain ids (no populate). */
export interface UserMembership {
  roleId: string | null;
  departmentIds: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserBlock.name)
    private userBlockModel: Model<UserBlockDocument>,
    private readonly firebaseAdmin: FirebaseAdminService,
    // Blocking someone also ends the friendship (both directions, pending too).
    private readonly friendsService: FriendsService,
    @InjectModel(Role.name) private roleModel?: Model<RoleDocument>,
  ) {}

  /**
   * The effective role name for a user's `roleId`: the Role's name, or
   * 'Member' when no role is assigned or it was deleted — the same fallback
   * ClaimsService puts in the JWT, so /me and the token never disagree.
   * Looked up by id because `User.roleId` has no Mongoose `ref` (adding one
   * would turn `roleId` in every user payload into an object).
   */
  async getRoleName(roleId: unknown): Promise<string> {
    const id = roleId?.toString();
    if (!id || !isValidObjectId(id) || !this.roleModel) return 'Member';
    const role = await this.roleModel.findById(id).select('name').lean().exec();
    return role?.name ?? 'Member';
  }

  /** Every role's name by id, for batch profile lookups (a deployment has a handful of roles). */
  async getRoleNameMap(): Promise<Map<string, string>> {
    if (!this.roleModel) return new Map();
    const roles = await this.roleModel.find().select('name').lean().exec();
    return new Map(roles.map((r) => [String(r._id), r.name]));
  }

  /**
   * Login / OTP lookup. The typed address is normalized (trim + lower-case)
   * and matched exactly — invitations store emails that way — then falls back
   * to a case-insensitive match for legacy mixed-case rows, so `Bob@acme.com`
   * finds bob's account instead of failing (and counting toward lockout).
   * otpCode/otpExpires are select:false (never leak via /me or /search); the
   * OTP + login flows read them through this internal lookup only.
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const exact = await this.userModel
      .findOne({ email: normalized })
      .select(AUTH_SECRET_FIELDS)
      .exec();
    return exact ?? this.findByEmailInsensitive(normalized, AUTH_SECRET_FIELDS);
  }

  /**
   * Case-insensitive exact email lookup (invite-only onboarding: invitations
   * store emails lowercase, legacy user rows may be mixed-case). Regex is
   * anchored + escaped so it is an exact match, never a partial one.
   * `select` adds select:false fields (the login flow needs the password hash).
   */
  async findByEmailInsensitive(
    email: string,
    select?: string,
  ): Promise<UserDocument | null> {
    const trimmed = (email ?? '').trim();
    if (!trimmed) return null;
    const query = this.userModel.findOne({
      email: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' },
    });
    return (select ? query.select(select) : query).exec();
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

  /** Current role/department ids of a user (null for an unknown / malformed id). */
  async getMembership(userId: string): Promise<UserMembership | null> {
    if (!isObjectIdString(userId)) return null;
    const doc = await this.userModel
      .findById(userId)
      .select('roleId departmentIds')
      .lean()
      .exec();
    if (!doc) return null;
    return {
      roleId: doc.roleId ? String(doc.roleId) : null,
      departmentIds: (doc.departmentIds ?? []).map(String),
    };
  }

  /** Active users holding `roleId`, excluding `excludeUserId` (last-Owner guards). */
  countActiveWithRole(roleId: string, excludeUserId: string): Promise<number> {
    return this.userModel
      .countDocuments({ _id: { $ne: excludeUserId }, roleId, status: 'active' })
      .exec();
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

  /**
   * Single write path for a new password (change / first set / reset). Setting
   * any password also completes the Google-invite onboarding step, so the
   * `mustSetPassword` flag is cleared here.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { password: passwordHash, mustSetPassword: false },
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

  /**
   * Mark the email verified WITHOUT consuming the OTP: the mobile forgot-password
   * flow verifies first and then resets with the same code. The code is consumed
   * by a successful reset (updatePassword) or simply expires (5 min).
   */
  async setVerified(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { isVerified: true },
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
  // Dùng khi: user đăng nhập bằng email thường, sau đó link Google
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

  /**
   * Register an FCM token for `userId`. A device token belongs to ONE account
   * at a time: it is pulled from every other user first, otherwise a phone that
   * switched accounts keeps receiving the previous user's lock-screen pushes.
   */
  async addDeviceToken(userId: string, token: string): Promise<void> {
    if (typeof token !== 'string' || !token.trim()) return;
    await this.userModel
      .updateMany(
        { _id: { $ne: userId }, fcmTokens: token },
        { $pull: { fcmTokens: token } },
      )
      .exec();
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: token },
    });
  }

  /** Unregister an FCM token from the caller (logout). Idempotent. */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $pull: { fcmTokens: token } })
      .exec();
  }

  /**
   * Record that `userId` blocks `targetId` (idempotent) and end any friendship
   * or pending request between them, in both directions.
   */
  async blockUser(
    userId: string,
    targetId: string,
  ): Promise<{ success: true }> {
    if (userId === targetId) {
      // Legacy `message` kept for clients that still match on it.
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: AuthCode.CANNOT_BLOCK_SELF,
        message: 'You cannot block yourself',
      });
    }
    await this.userBlockModel.updateOne(
      { blockerId: userId, blockedId: targetId },
      { $setOnInsert: { blockerId: userId, blockedId: targetId } },
      { upsert: true },
    );
    await this.friendsService.removeFriend(userId, targetId);
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
