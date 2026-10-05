import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ToolContext, ToolDefinition } from './tool.interface';
import { userIdQueryValues } from '../common/user-names';

@Injectable()
export class GetUserInfoTool {
  static readonly definition: ToolDefinition = {
    name: 'get_user_info',
    description: 'Get profile information about the user you are chatting with.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async execute(_input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const users = this.connection.collection('users');
    // People have ObjectId `_id`s — a raw-string lookup never found them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await users.findOne({ _id: { $in: userIdQueryValues([ctx.userId]) } } as any);

    if (!user) return 'User not found';

    const info: Record<string, unknown> = { displayName: user['displayName'] };
    if (user['bio']) info['bio'] = user['bio'];
    if (user['gender']) info['gender'] = user['gender'];
    if (user['dateOfBirth']) info['dateOfBirth'] = user['dateOfBirth'];
    if (user['phone']) info['phone'] = user['phone'];

    return JSON.stringify(info);
  }
}
