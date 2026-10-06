import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { McpConnectorClient } from '../tools/mcp-connector.client';
import { isConnectorTool } from '../tools/tool-names';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { ActionFollowUpService } from './action-follow-up.service';
import { classifyToolResult } from './action-outcome';
import { ClaimFailure, PendingActionStore } from './pending-action.store';
import {
  ACTION_RESOLVED_CHANNEL,
  ActionOutcome,
  ActionResolvedEvent,
  PendingActionErrorCode,
  PendingActionRecord,
  ResolvedActionStatus,
} from './pending-action.types';

/** Error body with `code` at the top level (same contract as every other service). */
function actionError(reason: ClaimFailure): HttpException {
  switch (reason) {
    case 'not_owner':
      return new ForbiddenException({
        statusCode: 403,
        code: PendingActionErrorCode.NOT_OWNER,
        message: 'Only the member who asked can confirm or cancel this action',
      });
    case 'already_resolved':
      return new ConflictException({
        statusCode: 409,
        code: PendingActionErrorCode.ALREADY_RESOLVED,
        message: 'This action was already confirmed or cancelled',
      });
    case 'expired':
      return new GoneException({
        statusCode: 410,
        code: PendingActionErrorCode.EXPIRED,
        message: 'This action expired',
      });
    default:
      return new NotFoundException({
        statusCode: 404,
        code: PendingActionErrorCode.NOT_FOUND,
        message: 'Action not found',
      });
  }
}

/**
 * Confirm / cancel of a pending AI action (CONTRACTS-ROUND2 §F2).
 *
 * Confirm runs the STORED input — the request body is never read — exactly
 * once (single-use claim), through the same connector client the loop uses, so
 * connector-service re-checks governance at this moment. The outcome goes to
 * chat-service on `ai:action:resolved` and the user gets a short follow-up AI
 * reply; the HTTP response does not wait for that reply.
 */
@Injectable()
export class PendingActionService {
  private readonly logger = new Logger(PendingActionService.name);

  constructor(
    private readonly store: PendingActionStore,
    private readonly connector: McpConnectorClient,
    private readonly publisher: RedisPublisherService,
    private readonly followUp: ActionFollowUpService,
  ) {}

  async confirm(id: string, userId: string): Promise<{ status: 'confirmed' | 'failed' }> {
    const record = await this.claimOrThrow(id, userId, 'confirmed');
    const outcome = await this.execute(record);
    this.logger.log(
      `Action ${record.id} (${record.toolName}) confirmed by ${userId}: ${outcome.status}` +
        (outcome.code ? ` [${outcome.code}]` : ''),
    );
    await this.publishResolved(record, outcome.status, outcome.code);
    void this.followUp
      .post(record, outcome)
      .catch((err) => this.logger.error(`Follow-up for action ${record.id} failed`, err));
    return { status: outcome.status };
  }

  async cancel(id: string, userId: string): Promise<{ status: 'cancelled' }> {
    const record = await this.claimOrThrow(id, userId, 'cancelled');
    this.logger.log(`Action ${record.id} (${record.toolName}) cancelled by ${userId}`);
    await this.publishResolved(record, 'cancelled');
    return { status: 'cancelled' };
  }

  private async claimOrThrow(
    id: string,
    userId: string,
    status: 'confirmed' | 'cancelled',
  ): Promise<PendingActionRecord> {
    const claim = await this.store.claim(id, userId, status);
    if (!claim.record) throw actionError(claim.failure ?? 'not_found');
    return claim.record;
  }

  private async execute(record: PendingActionRecord): Promise<ActionOutcome> {
    // Only connector tools are ever staged; anything else is a corrupt record.
    if (!isConnectorTool(record.toolName)) {
      return { status: 'failed', code: 'INVALID_TOOL', result: 'Tool error: [INVALID_TOOL]' };
    }
    try {
      const result = await this.connector.callTool(record.userId, record.toolName, record.input, {
        write: true,
      });
      return classifyToolResult(result);
    } catch (err) {
      // callTool never throws by contract — keep a failure a failure anyway.
      this.logger.error(`Executing action ${record.id} threw`, err);
      return { status: 'failed', code: 'TOOL_FAILED', result: 'Tool error: [TOOL_FAILED]' };
    }
  }

  private async publishResolved(
    record: PendingActionRecord,
    status: ResolvedActionStatus,
    code?: string,
  ): Promise<void> {
    const event: ActionResolvedEvent = {
      actionId: record.id,
      conversationId: record.conversationId,
      replyId: record.replyId,
      status,
      ...(code ? { resultSummary: code } : {}),
    };
    try {
      await this.publisher.publishToChannel(ACTION_RESOLVED_CHANNEL, event);
    } catch (err) {
      // The decision is final either way; the card just stays stale until reload.
      this.logger.error(`Could not publish ${ACTION_RESOLVED_CHANNEL} for ${record.id}`, err);
    }
  }
}
