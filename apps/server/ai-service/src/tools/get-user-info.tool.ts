import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { toObjectId } from '../common/object-id';
import { ToolContext, ToolDefinition } from './tool.interface';

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
    const id = toObjectId(ctx.userId);
    if (!id) return 'User not found';

    const users = this.connection.collection('users');
    const user = await users.findOne({ _id: id });

    if (!user) return 'User not found';

    const info: Record<string, unknown> = { displayName: user['displayName'] };
    if (user['bio']) info['bio'] = user['bio'];
    if (user['gender']) info['gender'] = user['gender'];
    if (user['dateOfBirth']) info['dateOfBirth'] = user['dateOfBirth'];
    if (user['phoneNumber']) info['phoneNumber'] = user['phoneNumber'];

    return JSON.stringify(info);
  }
}
