import { Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, JwtUser } from '@platform/database';
import { PendingActionService } from './pending-action.service';

interface AuthedRequest {
  user: JwtUser;
}

/**
 * In-chat confirmation of sensitive AI actions (CONTRACTS-ROUND2 §F2). JWT
 * only, scoped to the caller: just the member whose request produced the
 * action may resolve it. Mounted at `/ai/actions` on ai-service (no global
 * prefix) — through the mini's Caddy that is `/api/ai/ai/actions/...`.
 *
 * Neither route reads a body: confirm executes the input stored when the AI
 * prepared the action, never anything sent by the client.
 */
@ApiTags('ai-actions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/actions')
export class ActionsController {
  constructor(private readonly actions: PendingActionService) {}

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a pending AI action — runs it once with the stored input' })
  @ApiParam({ name: 'id', description: 'Pending action id (uuid) from AI_ACTION_PENDING / pendingActions[]' })
  @ApiResponse({ status: 200, description: '{ status: "confirmed" | "failed" }' })
  @ApiResponse({ status: 403, description: 'ACTION_NOT_OWNER' })
  @ApiResponse({ status: 404, description: 'ACTION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ACTION_ALREADY_RESOLVED' })
  @ApiResponse({ status: 410, description: 'ACTION_EXPIRED' })
  confirm(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.actions.confirm(id, req.user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending AI action — it will not run' })
  @ApiParam({ name: 'id', description: 'Pending action id (uuid)' })
  @ApiResponse({ status: 200, description: '{ status: "cancelled" }' })
  @ApiResponse({ status: 403, description: 'ACTION_NOT_OWNER' })
  @ApiResponse({ status: 404, description: 'ACTION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'ACTION_ALREADY_RESOLVED' })
  @ApiResponse({ status: 410, description: 'ACTION_EXPIRED' })
  cancel(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.actions.cancel(id, req.user.sub);
  }
}
