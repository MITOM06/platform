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
    return this.userModel.find({
      $or: [
        { email: new RegExp(query, 'i') },
        { displayName: new RegExp(query, 'i') },
      ],
    }).limit(10).select('-password').exec();
  }

  // ❌ Xóa toàn bộ hàm logout — logic này thuộc AuthService
}