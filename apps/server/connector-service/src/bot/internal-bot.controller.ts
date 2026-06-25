import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from '../internal/internal-key.guard';
import { BotSessionService } from './bot-session.service';

class InternalBotSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  botUserId: string;
}

/**
 * Internal-only bot session API for service-to-service orchestration (chat-service's
 * AssistantProvisioningService). Mirrors {@link BotAdminController}'s issue/revoke but is
 * protected by {@link InternalKeyGuard} (`x-internal-key`) instead of a user JWT, because the
 * caller is a trusted backend acting on behalf of a member during self-service assistant setup.
 */
@ApiTags('internal')
@UseGuards(InternalKeyGuard)
@Controller('internal/bot')
export class InternalBotController {
  constructor(
    private readonly sessions: BotSessionService,
    private readonly config: ConfigService,
  ) {}

  /** Issue (or replace) a bot session token. Returns the plaintext token once, plus the MCP URL. */
  @Post('sessions')
  @ApiOperation({ summary: 'Issue a bot session token (internal, returned once)' })
  async issue(@Body() dto: InternalBotSessionDto) {
    const token = await this.sessions.issue(dto.userId, dto.botUserId);
    const mcpUrl = this.config.get<string>('mcpServerUrl');
    return { token, mcpUrl };
  }

  /** Revoke a bot session — the Bot Factory bot loses tool access immediately. */
  @Delete('sessions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a bot session token (internal)' })
  async revoke(@Body() dto: InternalBotSessionDto) {
    await this.sessions.revoke(dto.userId, dto.botUserId);
  }
}
