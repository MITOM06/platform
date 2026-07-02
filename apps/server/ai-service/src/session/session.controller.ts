import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, JwtUser } from '@platform/database';
import { AiSessionService } from './ai-session.service';

interface AuthedRequest {
  user: JwtUser;
}

/**
 * AI session management API (Phase 1/2). All routes are scoped to the caller
 * (`req.user.sub` from the shared JWT guard) — a user can only see/mutate their
 * own sessions. Mounted directly on ai-service (port 3002), no global prefix.
 */
@ApiTags('ai-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/sessions')
export class SessionController {
  constructor(private readonly aiSessionService: AiSessionService) {}

  @Get(':conversationId')
  @ApiOperation({ summary: "List the caller's AI sessions in a conversation" })
  listSessions(@Param('conversationId') conversationId: string, @Req() req: AuthedRequest) {
    return this.aiSessionService.listSessions(req.user.sub, conversationId);
  }

  @Post(':conversationId/new')
  @ApiOperation({ summary: 'Start a new AI session (deactivates the current one)' })
  createNewSession(@Param('conversationId') conversationId: string, @Req() req: AuthedRequest) {
    return this.aiSessionService.createNewSession(req.user.sub, conversationId);
  }

  @Post(':conversationId/resume/:sessionId')
  @ApiOperation({ summary: 'Resume a previous AI session' })
  async resumeSession(
    @Param('conversationId') conversationId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthedRequest,
  ) {
    const session = await this.aiSessionService.resumeSession(
      sessionId,
      req.user.sub,
      conversationId,
    );
    // Not found / not owned → 404 (never a 200 with a null body, which crashes
    // strongly-typed clients casting the response).
    if (!session) throw new NotFoundException('AI session not found');
    return session;
  }

  @Patch(':sessionId/rename')
  @ApiOperation({ summary: 'Rename an AI session' })
  async renameSession(
    @Param('sessionId') sessionId: string,
    @Body('name') name: string,
    @Req() req: AuthedRequest,
  ) {
    const session = await this.aiSessionService.renameSession(sessionId, req.user.sub, name);
    if (!session) throw new NotFoundException('AI session not found');
    return session;
  }
}
