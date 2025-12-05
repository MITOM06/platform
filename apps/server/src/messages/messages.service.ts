import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message } from './schemas/message.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class MessagesService {
  constructor(@InjectModel(Message.name) private model: Model<Message>) {}

  async send(sender: string, recipient: string, content: string) {
    return this.model.create({
      sender: new Types.ObjectId(sender),
      recipient: new Types.ObjectId(recipient),
      content,
    });
  }

  async history(a: string, b: string, limit = 50) {
    const A = new Types.ObjectId(a);
    const B = new Types.ObjectId(b);
    return this.model
      .find({
        $or: [
          { sender: A, recipient: B },
          { sender: B, recipient: A },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async markSeen(ids: string[]) {
    const _ids = ids.map((id) => new Types.ObjectId(id));
    await this.model.updateMany({ _id: { $in: _ids } }, { $set: { seen: true } });
  }
}