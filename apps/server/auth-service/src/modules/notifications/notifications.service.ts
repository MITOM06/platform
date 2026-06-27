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
}
