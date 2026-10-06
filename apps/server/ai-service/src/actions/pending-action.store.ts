import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';
import { providerOf } from '../tools/tool-names';
import { buildActionSummary } from './pending-action-summary';
import {
  DEFAULT_PENDING_ACTION_TTL_SEC,
  PENDING_ACTION_EXPIRED_GRACE_SEC,
  pendingActionClaimKey,
  pendingActionKey,
  PendingActionRecord,
  PendingActionView,
} from './pending-action.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REQUEST_TEXT = 500;

export interface NewPendingAction {
  userId: string;
  displayName: string;
  conversationId: string;
  departmentId?: string;
  replyId: string;
  toolName: string;
  input: Record<string, unknown>;
  requestText: string;
}

export type ClaimFailure = 'not_found' | 'not_owner' | 'already_resolved' | 'expired';

/** Exactly one of the two is set (this package compiles without strictNullChecks). */
export interface ClaimResult {
  record?: PendingActionRecord;
  failure?: ClaimFailure;
}

interface ClaimMarker {
  status: string;
  userId: string;
}

/** The client-facing view of a stored record. */
export function toPendingActionView(record: PendingActionRecord): PendingActionView {
  return {
    id: record.id,
    toolName: record.toolName,
    provider: record.provider,
    summary: record.summary,
    status: 'pending',
    expiresAt: record.expiresAt,
  };
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Redis persistence of pending actions: `ai:pending-action:{id}` holds the
 * record (JSON), `ai:pending-action:{id}:claim` the single-use claim.
 *
 * The record lives `ttl + grace`: `expiresAt` (= created + ttl) is what the
 * user sees and what is enforced; the grace only lets a late click get a
 * precise 410 instead of a 404. The first confirm/cancel takes the claim with
 * `SET NX` — the only atomic step, so two concurrent clicks can never both
 * execute — then deletes the record, so the stored input does not outlive the
 * decision. The claim marker stays until the record would have expired, so a
 * repeat click gets 409, not 404.
 */
@Injectable()
export class PendingActionStore {
  private readonly logger = new Logger(PendingActionStore.name);
  private readonly ttlSec: number;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    const ttl = this.configService.get<number>('config.actions.pendingTtlSec');
    this.ttlSec =
      typeof ttl === 'number' && Number.isFinite(ttl) && ttl > 0
        ? Math.floor(ttl)
        : DEFAULT_PENDING_ACTION_TTL_SEC;
  }

  /** Store a new pending action. Throws on a Redis failure (the caller fails closed). */
  async create(params: NewPendingAction, now: Date = new Date()): Promise<PendingActionRecord> {
    const record: PendingActionRecord = {
      id: randomUUID(),
      userId: params.userId,
      conversationId: params.conversationId,
      replyId: params.replyId,
      toolName: params.toolName,
      input: params.input ?? {},
      provider: providerOf(params.toolName) ?? '',
      summary: buildActionSummary(params.toolName, params.input),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlSec * 1000).toISOString(),
      displayName: params.displayName,
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      requestText: (params.requestText ?? '').slice(0, MAX_REQUEST_TEXT),
    };
    await this.redis.set(
      pendingActionKey(record.id),
      JSON.stringify(record),
      'EX',
      this.ttlSec + PENDING_ACTION_EXPIRED_GRACE_SEC,
    );
    return record;
  }

  /**
   * Take the single-use claim for `userId`. Order matters: ownership is checked
   * BEFORE anything is consumed (a non-owner never burns the action), an
   * expired action cannot be claimed, and only the `SET NX` winner proceeds.
   */
  async claim(
    id: string,
    userId: string,
    status: 'confirmed' | 'cancelled',
    now: number = Date.now(),
  ): Promise<ClaimResult> {
    if (typeof id !== 'string' || !UUID_RE.test(id)) return { failure: 'not_found' };
    const [rawRecord, rawClaim] = await this.redis.mget(pendingActionKey(id), pendingActionClaimKey(id));
    const record = parseJson<PendingActionRecord>(rawRecord);
    const claim = parseJson<ClaimMarker>(rawClaim);

    if (!record) {
      // Already resolved (record consumed) — still never tell a stranger more than "not yours".
      if (claim) return { failure: claim.userId === userId ? 'already_resolved' : 'not_owner' };
      return { failure: 'not_found' };
    }
    if (record.userId !== userId) return { failure: 'not_owner' };
    if (claim) return { failure: 'already_resolved' };
    const expiresAtMs = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAtMs) || now >= expiresAtMs) return { failure: 'expired' };

    const markerTtlSec = Math.max(
      60,
      Math.ceil((expiresAtMs + PENDING_ACTION_EXPIRED_GRACE_SEC * 1000 - now) / 1000),
    );
    const won = await this.redis.set(
      pendingActionClaimKey(id),
      JSON.stringify({ status, userId } satisfies ClaimMarker),
      'EX',
      markerTtlSec,
      'NX',
    );
    if (won !== 'OK') return { failure: 'already_resolved' };

    await this.redis
      .del(pendingActionKey(id))
      .catch((err) =>
        this.logger.warn(`Could not delete claimed pending action ${id}: ${(err as Error).message}`),
      );
    return { record };
  }

  /** Best-effort delete of actions whose reply never completed (nobody can see their card). */
  async discard(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await this.redis.del(...ids.map((id) => pendingActionKey(id)));
    } catch (err) {
      this.logger.warn(`Could not discard pending actions: ${(err as Error).message}`);
    }
  }
}
