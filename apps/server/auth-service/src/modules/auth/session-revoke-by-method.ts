import type { Redis } from '@platform/database';
import type { SessionMethod } from './session-method';

/**
 * Revokes the user's sessions that were NOT created by `keep` (Require SSO:
 * keep `oidc`). A session without a `method` (created before it was recorded)
 * counts as not `keep`; an expired hash only drops its stale sid (never
 * recreates `sess:<sid>`). Returns how many sessions were revoked — the caller
 * publishes the revocation event when that is more than zero. Split out of
 * SessionService like session-claims.ts.
 */
export async function revokeUserSessionsNotCreatedBy(
  redis: Redis,
  userId: string,
  keep: SessionMethod,
): Promise<number> {
  const userSessKey = `user:${userId}:sessions`;
  const sids: string[] = (await redis.smembers(userSessKey)) ?? [];
  if (sids.length === 0) return 0;

  const read = redis.pipeline();
  for (const sid of sids) read.hmget(`sess:${sid}`, 'userId', 'method');
  const rows = (await read.exec()) ?? [];

  const write = redis.pipeline();
  let revoked = 0;
  sids.forEach((sid, i) => {
    const [err, fields] = (rows[i] ?? [null, null]) as [
      Error | null,
      (string | null)[] | null,
    ];
    if (err) return;
    const [owner, method] = fields ?? [null, null];
    if (!owner) {
      write.srem(userSessKey, sid);
      return;
    }
    if (owner !== userId || method === keep) return;
    write.hset(`sess:${sid}`, { revoked: '1' });
    write.srem(userSessKey, sid);
    revoked += 1;
  });
  await write.exec();
  return revoked;
}
