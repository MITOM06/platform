import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PendingActionStore } from './pending-action.store';
import { PendingActionService } from './pending-action.service';
import { ActionFollowUpService } from './action-follow-up.service';
import {
  ACTION_RESOLVED_CHANNEL,
  pendingActionKey,
  PendingActionRecord,
} from './pending-action.types';
import { McpConnectorClient, WRITE_TIMEOUT_RESULT } from '../tools/mcp-connector.client';
import { RedisPublisherService } from '../redis/redis-publisher.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisMock = require('ioredis-mock');

const STORED_INPUT = { to: 'bob@example.com', subject: 'Q3 report', body: 'Hi Bob' };

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(
    () => {
      throw new Error('expected an HTTP error');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getStatus()).toBe(status);
  // `code` at the TOP level of the body (client error contract).
  expect((err as HttpException).getResponse()).toMatchObject({ code, statusCode: status });
}

describe('PendingActionService — confirm / cancel (§F2)', () => {
  let redis: any;
  let store: PendingActionStore;
  let callTool: jest.Mock;
  let publishToChannel: jest.Mock;
  let post: jest.Mock;
  let service: PendingActionService;

  const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;

  beforeEach(() => {
    redis = new RedisMock();
    store = new PendingActionStore(redis, config);
    callTool = jest.fn().mockResolvedValue('Email sent to bob@example.com');
    publishToChannel = jest.fn().mockResolvedValue(undefined);
    post = jest.fn().mockResolvedValue(undefined);
    service = new PendingActionService(
      store,
      { callTool } as unknown as McpConnectorClient,
      { publishToChannel } as unknown as RedisPublisherService,
      { post } as unknown as ActionFollowUpService,
    );
  });

  afterEach(async () => {
    await redis.flushall();
  });

  function stage(createdAt?: Date): Promise<PendingActionRecord> {
    return store.create(
      {
        userId: 'user-1',
        displayName: 'Alice',
        conversationId: 'conv-1',
        replyId: 'reply-1',
        toolName: 'mcp__gmail__send_email',
        input: STORED_INPUT,
        requestText: 'Email Bob the Q3 report',
      },
      createdAt,
    );
  }

  it('confirm executes the STORED input once, publishes the resolution and posts a follow-up', async () => {
    const record = await stage();

    await expect(service.confirm(record.id, 'user-1')).resolves.toEqual({ status: 'confirmed' });

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith('user-1', 'mcp__gmail__send_email', STORED_INPUT, {
      write: true,
    });
    expect(publishToChannel).toHaveBeenCalledWith(ACTION_RESOLVED_CHANNEL, {
      actionId: record.id,
      conversationId: 'conv-1',
      replyId: 'reply-1',
      status: 'confirmed',
    });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ id: record.id, input: STORED_INPUT }),
      expect.objectContaining({ status: 'confirmed' }),
    );
    // Consumed: the stored input does not outlive the decision.
    expect(await redis.get(pendingActionKey(record.id))).toBeNull();
  });

  it('a second confirm is 409 ACTION_ALREADY_RESOLVED and never re-executes', async () => {
    const record = await stage();
    await service.confirm(record.id, 'user-1');

    await expectHttpError(service.confirm(record.id, 'user-1'), 409, 'ACTION_ALREADY_RESOLVED');
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it('two concurrent confirms execute exactly once (single-use claim)', async () => {
    const record = await stage();

    const results = await Promise.allSettled([
      service.confirm(record.id, 'user-1'),
      service.confirm(record.id, 'user-1'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rejected.reason as HttpException).getStatus()).toBe(409);
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it('another member gets 403 ACTION_NOT_OWNER and the action is NOT consumed', async () => {
    const record = await stage();

    await expectHttpError(service.confirm(record.id, 'user-2'), 403, 'ACTION_NOT_OWNER');
    await expectHttpError(service.cancel(record.id, 'user-2'), 403, 'ACTION_NOT_OWNER');
    expect(callTool).not.toHaveBeenCalled();
    expect(publishToChannel).not.toHaveBeenCalled();

    // The requester can still confirm it.
    await expect(service.confirm(record.id, 'user-1')).resolves.toEqual({ status: 'confirmed' });
    // …and after that a stranger still only learns "not yours".
    await expectHttpError(service.confirm(record.id, 'user-2'), 403, 'ACTION_NOT_OWNER');
  });

  it.each([
    ['an unknown id', '9b2f6c1e-1d1a-4c55-9d0e-3c8f2a4b5e61'],
    ['a malformed id', 'ai:pending-action:*'],
  ])('404 ACTION_NOT_FOUND for %s', async (_label, id) => {
    await expectHttpError(service.confirm(id, 'user-1'), 404, 'ACTION_NOT_FOUND');
    await expectHttpError(service.cancel(id, 'user-1'), 404, 'ACTION_NOT_FOUND');
  });

  it('410 ACTION_EXPIRED after expiresAt (record kept for the grace period) — never executed', async () => {
    const record = await stage(new Date(Date.now() - 11 * 60 * 1000)); // expired 1 min ago

    await expectHttpError(service.confirm(record.id, 'user-1'), 410, 'ACTION_EXPIRED');
    await expectHttpError(service.cancel(record.id, 'user-1'), 410, 'ACTION_EXPIRED');
    expect(callTool).not.toHaveBeenCalled();
  });

  it('404 once the record itself is gone (TTL elapsed)', async () => {
    const record = await stage();
    await redis.del(pendingActionKey(record.id));

    await expectHttpError(service.confirm(record.id, 'user-1'), 404, 'ACTION_NOT_FOUND');
  });

  it('reports a connector failure as "failed" with a machine code only', async () => {
    callTool.mockResolvedValue('Tool error: [NOT_PERMITTED] Gmail is not allowed for this member');
    const record = await stage();

    await expect(service.confirm(record.id, 'user-1')).resolves.toEqual({ status: 'failed' });

    expect(publishToChannel).toHaveBeenCalledWith(ACTION_RESOLVED_CHANNEL, {
      actionId: record.id,
      conversationId: 'conv-1',
      replyId: 'reply-1',
      status: 'failed',
      resultSummary: 'NOT_PERMITTED',
    });
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'failed', code: 'NOT_PERMITTED' }),
    );
  });

  it('a write timeout is "failed" with OUTCOME_UNKNOWN (it may have happened)', async () => {
    callTool.mockResolvedValue(WRITE_TIMEOUT_RESULT);
    const record = await stage();

    await expect(service.confirm(record.id, 'user-1')).resolves.toEqual({ status: 'failed' });
    expect(publishToChannel).toHaveBeenCalledWith(
      ACTION_RESOLVED_CHANNEL,
      expect.objectContaining({ status: 'failed', resultSummary: 'OUTCOME_UNKNOWN' }),
    );
  });

  it('cancel resolves without executing, then confirm is 409', async () => {
    const record = await stage();

    await expect(service.cancel(record.id, 'user-1')).resolves.toEqual({ status: 'cancelled' });

    expect(callTool).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled(); // no follow-up reply on cancel
    expect(publishToChannel).toHaveBeenCalledWith(ACTION_RESOLVED_CHANNEL, {
      actionId: record.id,
      conversationId: 'conv-1',
      replyId: 'reply-1',
      status: 'cancelled',
    });
    expect(await redis.get(pendingActionKey(record.id))).toBeNull();
    await expectHttpError(service.confirm(record.id, 'user-1'), 409, 'ACTION_ALREADY_RESOLVED');
    await expectHttpError(service.cancel(record.id, 'user-1'), 409, 'ACTION_ALREADY_RESOLVED');
  });

  it('a failed resolution publish does not undo the decision', async () => {
    publishToChannel.mockRejectedValue(new Error('redis down'));
    const record = await stage();

    await expect(service.confirm(record.id, 'user-1')).resolves.toEqual({ status: 'confirmed' });
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});
