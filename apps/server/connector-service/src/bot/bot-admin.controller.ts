import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  Capability,
  JwtAuthGuard,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { BotSessionService } from './bot-session.service';

class BotSessionDto {
  userId: string;
  botUserId: string;
}

/**
 * Admin-only API to issue/revoke bot session tokens. The `@RequirePermission`
 * decorator is enforced by `RequirePermissionGuard` (both guards are required —
 * the decorator alone only sets metadata).
 */
@ApiTags('bot-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
@Controller('api/bot')
export class BotAdminController {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a bot session token. Returns the plaintext token once — admin must
   * copy it immediately and configure it in Bot Factory as the MCP Bearer token.
   */
  @Post('sessions')
  @ApiOperation({ summary: 'Issue a bot session token (returned once)' })
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async issue(@Body() dto: BotSessionDto) {
    const token = await this.sessions.issue(dto.userId, dto.botUserId);
    const mcpUrl = this.config.get<string>('mcpServerUrl');
    return { token, mcpUrl };
  }

  /** Revoke a bot session — the Bot Factory bot loses tool access immediately. */
  @Delete('sessions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a bot session token' })
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async revoke(@Body() dto: BotSessionDto) {
    await this.sessions.revoke(dto.userId, dto.botUserId);
  }

  /** List active bot sessions for a user (token hashes never returned). */
  @Get('sessions')
  @ApiOperation({ summary: 'List active bot sessions for a user' })
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async list(@Query('userId') userId: string) {
    const sessions = await this.sessions.findForUser(userId);
    return {
      sessions: sessions.map((s) => ({
        botUserId: s.botUserId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt ?? null,
      })),
    };
  }
}
