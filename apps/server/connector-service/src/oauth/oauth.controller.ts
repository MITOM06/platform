import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  RequirePermissionGuard,
} from '@platform/database';
import { OAuthService } from './oauth.service';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  // Guard + permission/allow-list gating applied per-route (NOT class-level)
  // so the public browser-redirect callback below stays unauthenticated.
  @Get(':provider/start')
  @UseGuards(JwtAuthGuard, RequirePermissionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin OAuth: returns the provider authorize URL' })
  start(
    @Param('provider') provider: string,
    @CurrentUser() user: JwtUser,
  ): { authorizeUrl: string } {
    return this.oauth.startAuthorization(provider, user.sub);
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
}
