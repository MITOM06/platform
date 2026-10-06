import { Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Capability,
  JwtAuthGuard,
  RequirePermission,
  RequirePermissionGuard,
} from '@platform/database';
import { BotSessionService } from './bot-session.service';
import { BotBridgeService } from './bot-bridge.service';
import { BotSessionDto, BotSessionListQueryDto } from './bot.dto';

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
    private readonly bridge: BotBridgeService,
  ) {}

  /**
   * Issue a bot session token for a member's own bot. Returns the plaintext
   * token once (with its expiry) — the admin configures it in Bot Factory as
   * the MCP Bearer token.
   */
  @Post('sessions')
  @ApiOperation({ summary: 'Issue a bot session token (returned once)' })
  @RequirePermission(Capability.MANAGE_WORKSPACE)
  async issue(@Body() dto: BotSessionDto) {
    const mcpUrl = this.bridge.requireMcpServerUrl();
    await this.bridge.assertIssuable(dto.userId, dto.botUserId);
    const { token, expiresAt } = await this.sessions.issue(dto.userId, dto.botUserId);
    return { token, mcpUrl, expiresAt };
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
  async list(@Query() query: BotSessionListQueryDto) {
    const sessions = await this.sessions.findForUser(query.userId);
    return {
      sessions: sessions.map((s) => ({
        botUserId: s.botUserId,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt ?? null,
        expiresAt: new Date(this.sessions.expiryOf(s)),
      })),
    };
  }
}
