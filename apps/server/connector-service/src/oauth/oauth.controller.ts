import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OAuthService } from './oauth.service';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get(':provider/start')
  @ApiOperation({ summary: 'Begin OAuth: returns the provider authorize URL' })
  @ApiQuery({ name: 'userId', required: true })
  start(
    @Param('provider') provider: string,
    @Query('userId') userId: string,
  ): { authorizeUrl: string } {
    return this.oauth.startAuthorization(provider, userId);
  }

  @Get(':provider/callback')
  @ApiOperation({
    summary: 'OAuth redirect target: exchange code, persist tokens, bounce to client',
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
