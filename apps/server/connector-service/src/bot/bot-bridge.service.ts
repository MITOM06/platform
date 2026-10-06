import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PermResolverService } from '../internal/perm-resolver.service';
import { ExternalBotRef, ExternalBotRefDocument } from './external-bot-ref.schema';

/**
 * Preconditions for issuing a Bot Factory session token.
 *
 *  - The bridge must be configured: without MCP_SERVER_URL the issue endpoints
 *    used to hand Bot Factory `http://localhost:3003/mcp`, creating assistants
 *    that could never reach PON. Now they answer 503 `BOT_BRIDGE_DISABLED`.
 *  - Admin issue: the member must exist and be active, and the bot must be the
 *    member's own (chat-service `external_bots.ownerUserId`).
 */
@Injectable()
export class BotBridgeService {
  constructor(
    private readonly config: ConfigService,
    private readonly perms: PermResolverService,
    @InjectModel(ExternalBotRef.name)
    private readonly botModel: Model<ExternalBotRefDocument>,
  ) {}

  /** The public MCP URL Bot Factory must call, or 503 when the bridge is not configured. */
  requireMcpServerUrl(): string {
    const url = this.config.get<string>('mcpServerUrl');
    if (!url) throw new ServiceUnavailableException({ code: 'BOT_BRIDGE_DISABLED' });
    return url;
  }

  async assertIssuable(userId: string, botUserId: string): Promise<void> {
    const member = await this.perms.resolveMember(userId);
    if (!member.exists) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (!member.active) throw new ForbiddenException({ code: 'MEMBER_INACTIVE' });
    const bot = await this.botModel
      .findOne({ botUserId }, { ownerUserId: 1 })
      .lean<{ ownerUserId?: string }>();
    if (!bot) throw new NotFoundException({ code: 'BOT_NOT_FOUND' });
    if (bot.ownerUserId !== userId) throw new BadRequestException({ code: 'BOT_OWNER_MISMATCH' });
  }
}
