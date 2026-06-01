import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@platform/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  // ❌ Xóa: session: any;  — không cần nữa

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    // ❌ Xóa: SessionService — UsersService không cần biết về session
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findByPhone(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).select('+password').exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('-password').exec();
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
  async findBySocialId(provider: string, socialId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ [`socialLinks.${provider}`]: socialId })
      .exec();
  }

  // ✅ Link hoặc update socialId cho user đã tồn tại
  // Dùng khi: user đăng nhập bằng email thường, sau đó link Google/Facebook/Twitter
  async updateSocialId(userId: string, provider: string, socialId: string): Promise<void> {
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
    return this.userModel.find({
      $or: [
        { email: pattern },
        { displayName: pattern },
      ],
    }).limit(10).select('-password').exec();
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }): Promise<UserDocument | null> {
    const updateData: any = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    if (Object.keys(updateData).length > 0) {
      return this.userModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password').exec();
    }
    return this.findById(userId);
  }

  async addDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: token },
    });
  }
}