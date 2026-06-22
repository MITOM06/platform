import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  RequirePermissionGuard,
} from '@platform/database';
import { OAuthService } from './oauth.service';
import { DirectoryConnectService, StartResult } from './directory-connect.service';
import { ConnectKeyDto } from '../directory/dto/directory.dto';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly directoryConnect: DirectoryConnectService,
  ) {}

  // ── Static catalog OAuth (Notion/Google) ──────────────────────────────────

  // Guard + permission/allow-list gating applied per-route (NOT class-level)
  // so the public browser-redirect callback below stays unauthenticated.
  @Get(':provider/start')
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin OAuth: returns the provider authorize URL' })
  start(
    @Param('provider') provider: string,
    @CurrentUser() user: JwtUser,
  ): Promise<{ authorizeUrl: string }> {
    return this.oauth.startAuthorization(provider, user);
  }

  @Get(':provider/callback')
  @ApiOperation({
    summary:
      'OAuth redirect target: exchange code, persist tokens, bounce to client',
  })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.oauth.handleCallback(provider, code, state);
    res.redirect(302, redirectUrl);
  }

  // ── Dynamic directory connect (MCP-native DCR/PKCE + fallbacks) ────────────

  @Get('directory/:slug/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Begin a directory connect: returns an authorize URL (oauth) or a flag for apikey/none',
  })
  startDirectory(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtUser,
  ): Promise<StartResult> {
    return this.directoryConnect.start(slug, user);
  }

  @Post('directory/:slug/connect-key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect an apikey directory entry with a pasted key' })
  connectKey(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ConnectKeyDto,
  ): Promise<{ connected: true }> {
    return this.directoryConnect.connectWithKey(slug, user, dto.credential);
  }

  @Get('directory/:slug/callback')
  @ApiOperation({
    summary:
      'Directory OAuth redirect target: exchange code (PKCE), persist, bounce to client',
  })
  async directoryCallback(
    @Param('slug') slug: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.directoryConnect.handleCallback(slug, code, state);
    res.redirect(302, redirectUrl);
  }
}
