import { Logger } from '@nestjs/common';
import { CLAIMS_CHANGED_CHANNEL, Redis } from '@platform/database';

/**
 * Redis side of `SessionService.markClaimsStale` (kept out of session.service.ts
 * for size). Key layout is SessionService's: `sess:{sid}` hash +
 * `user:{userId}:sessions` set.
 */

/**
 * Mark ONE session claims-stale. Only touches a live hash (HSET on a missing key
 * would recreate it without a TTL) and keeps its TTL; `claimsAt` only moves
 * forward. Returns 1 = marked, 0 = hash gone (dangling sid), 2 = revoked (left
 * alone).
 * KEYS[1] = sess key, ARGV[1] = claimsAt (unix seconds)
 */
export const MARK_CLAIMS_STALE_LUA = `
  if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
  if redis.call('HGET', KEYS[1], 'revoked') == '1' then return 2 end
  local cur = tonumber(redis.call('HGET', KEYS[1], 'claimsAt'))
  if cur == nil or cur < tonumber(ARGV[1]) then
    redis.call('HSET', KEYS[1], 'claimsAt', ARGV[1])
  end
  return 1
`;

/** Users per pipelined batch. */
const CHUNK = 500;

const sessKey = (sid: string) => `sess:${sid}`;
const userSessSetKey = (userId: string) => `user:${userId}:sessions`;

/**
 * Set `claimsAt = floor(now / 1000) + 1` on every live session of `userIds`, drop
 * dangling sids from the users' session sets and publish `auth:claims-changed`
 * `{"userId"}` once per user that had at least one live session marked.
 * Two pipelined round-trips per 500 users (+1 best-effort publish/cleanup).
 * A Redis failure while marking propagates; publish/cleanup never throws.
 */
export async function markUsersClaimsStale(
  redis: Redis,
  userIds: readonly string[],
  logger: Logger,
): Promise<{ users: number; sessions: number }> {
  const ids = [...new Set(userIds.filter((id) => !!id))];
  // +1: JWT `iat` has one-second resolution, so with `iat < claimsAt` a token
  // minted earlier in the same second as the change would otherwise keep the
  // old claims for its whole lifetime. Tokens minted after the change are
  // unaffected: `refresh` pins `iat` up to `claimsAt` when the clock is behind it.
  const claimsAt = (Math.floor(Date.now() / 1000) + 1).toString();
  let users = 0;
  let sessions = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await markChunk(
      redis,
      ids.slice(i, i + CHUNK),
      claimsAt,
      logger,
    );
    users += res.users;
    sessions += res.sessions;
  }
  return { users, sessions };
}

async function markChunk(
  redis: Redis,
  userIds: string[],
  claimsAt: string,
  logger: Logger,
): Promise<{ users: number; sessions: number }> {
  const setsPipe = redis.pipeline();
  for (const userId of userIds) setsPipe.smembers(userSessSetKey(userId));
  const sets = pipelineValues<string[]>(await setsPipe.exec());

  const targets: Array<{ userId: string; sid: string }> = [];
  userIds.forEach((userId, idx) => {
    for (const sid of sets[idx] ?? []) targets.push({ userId, sid });
  });
  if (targets.length === 0) return { users: 0, sessions: 0 };

  const markPipe = redis.pipeline();
  for (const { sid } of targets) {
    markPipe.eval(MARK_CLAIMS_STALE_LUA, 1, sessKey(sid), claimsAt);
  }
  const marks = pipelineValues<number>(await markPipe.exec());

  const marked = new Set<string>();
  const dangling: typeof targets = [];
  let sessions = 0;
  targets.forEach((t, idx) => {
    const r = Number(marks[idx]);
    if (r === 1) {
      sessions++;
      marked.add(t.userId);
    } else if (r === 0) {
      dangling.push(t);
    }
  });
  await publishAndCleanup(redis, [...marked], dangling, logger);
  return { users: marked.size, sessions };
}

/** Best effort, never throws: the claims are already marked. */
async function publishAndCleanup(
  redis: Redis,
  userIds: string[],
  dangling: Array<{ userId: string; sid: string }>,
  logger: Logger,
): Promise<void> {
  if (userIds.length === 0 && dangling.length === 0) return;
  try {
    const pipe = redis.pipeline();
    for (const { userId, sid } of dangling)
      pipe.srem(userSessSetKey(userId), sid);
    for (const userId of userIds) {
      pipe.publish(CLAIMS_CHANGED_CHANNEL, JSON.stringify({ userId }));
    }
    await pipe.exec();
  } catch (err) {
    logger.warn(
      `Failed to publish ${CLAIMS_CHANGED_CHANNEL} for ${userIds.length} user(s): ${(err as Error).message}`,
    );
  }
}

/**
 * Values of an ioredis `pipeline().exec()` result, in command order. A failed
 * command (or a null result = aborted pipeline) throws, like a direct call would.
 */
function pipelineValues<T>(
  results: Array<[Error | null, unknown]> | null,
): Array<T | undefined> {
  if (!results) throw new Error('Redis pipeline aborted');
  return results.map(([err, value]) => {
    if (err) throw err;
    return value as T | undefined;
  });
}
