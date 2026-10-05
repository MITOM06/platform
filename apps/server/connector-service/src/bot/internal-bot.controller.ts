import { Body, Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalKeyGuard } from '../internal/internal-key.guard';
import { BotSessionService } from './bot-session.service';
import { BotBridgeService } from './bot-bridge.service';
import { BotSessionDto } from './bot.dto';

/**
 * Internal-only bot session API for service-to-service orchestration (chat-service's
 * AssistantProvisioningService). Mirrors {@link BotAdminController}'s issue/revoke but is
 * protected by {@link InternalKeyGuard} (`x-internal-key`) instead of a user JWT, because the
 * caller is a trusted backend acting on behalf of a member during self-service assistant setup.
 * chat-service issues the token BEFORE registering the bot, so ownership is not checked here;
 * the member's standing is enforced on every MCP request instead (BotSessionGuard).
 */
@ApiTags('internal')
@UseGuards(InternalKeyGuard)
@Controller('internal/bot')
export class InternalBotController {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly bridge: BotBridgeService,
  ) {}

  /** Issue (or replace) a bot session token. Returns the plaintext token once, its expiry and the MCP URL. */
  @Post('sessions')
  @ApiOperation({ summary: 'Issue a bot session token (internal, returned once)' })
  async issue(@Body() dto: BotSessionDto) {
    const mcpUrl = this.bridge.requireMcpServerUrl();
    const { token, expiresAt } = await this.sessions.issue(dto.userId, dto.botUserId);
    return { token, mcpUrl, expiresAt };
  }

  /** Revoke a bot session — the Bot Factory bot loses tool access immediately. */
  @Delete('sessions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a bot session token (internal)' })
  async revoke(@Body() dto: BotSessionDto) {
    await this.sessions.revoke(dto.userId, dto.botUserId);
  }
}
