import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './notification.schema';

export interface CreateNotificationPayload {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actorId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(
    payload: CreateNotificationPayload,
  ): Promise<NotificationDocument> {
    return this.notificationModel.create(payload);
  }

  async listForUser(
    recipientId: string,
    limit = 50,
  ): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId,
      readAt: null,
    });
  }

  async markRead(id: string, recipientId: string): Promise<void> {
    await this.notificationModel
      .findOneAndUpdate(
        { _id: id, recipientId },
        { $set: { readAt: new Date() } },
      )
      .exec();
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        { recipientId, readAt: null },
        { $set: { readAt: new Date() } },
      )
      .exec();
  }

  /**
   * Called after every successful login (email+password or OAuth).
   * - Creates a PASSWORD_SETUP notification if the user has no local password
   *   (OAuth-only account).
   * - Creates a PHONE_SETUP notification if the user has not verified a phone.
   * - Auto-reads any outstanding PHONE_SETUP notification once the phone is
   *   verified.
   *
   * Uses `updateOne + $setOnInsert + upsert` so each type is created exactly
   * once per user — logging in 1000 times never produces a duplicate.
   */
  async createSetupNotificationsIfNeeded(
    userId: string,
    user: { hasPassword: boolean; phoneVerified: boolean },
  ): Promise<void> {
    const ops: Promise<unknown>[] = [];

    if (!user.hasPassword) {
      ops.push(
        this.notificationModel
          .updateOne(
            { recipientId: userId, type: 'PASSWORD_SETUP' },
            {
              $setOnInsert: {
                recipientId: userId,
                type: 'PASSWORD_SETUP',
                title: 'Bảo vệ tài khoản của bạn',
                body: 'Tài khoản của bạn chưa có mật khẩu. Hãy thiết lập mật khẩu để tăng tính bảo mật.',
                readAt: null,
              },
            },
            { upsert: true },
          )
          .exec(),
      );
    }

    if (!user.phoneVerified) {
      ops.push(
        this.notificationModel
          .updateOne(
            { recipientId: userId, type: 'PHONE_SETUP' },
            {
              $setOnInsert: {
                recipientId: userId,
                type: 'PHONE_SETUP',
                title: 'Xác minh số điện thoại',
                body: 'Thêm và xác minh số điện thoại để bạn bè có thể tìm thấy bạn và tăng tính bảo mật tài khoản.',
                readAt: null,
              },
            },
            { upsert: true },
          )
          .exec(),
      );
    } else {
      // Phone already verified → silently read any outstanding PHONE_SETUP nudge.
      ops.push(
        this.notificationModel
          .updateMany(
            { recipientId: userId, type: 'PHONE_SETUP', readAt: null },
            { $set: { readAt: new Date() } },
          )
          .exec(),
      );
    }

    await Promise.all(ops);
  }
}
