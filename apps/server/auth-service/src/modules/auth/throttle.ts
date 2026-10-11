import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { resolveClientIp } from '../../common/client-ip';

/**
 * Throttlers of the whole service (per client address unless noted):
 * - short:   5 req/s burst protection
 * - medium:  100 req/min
 * - session: per refresh SESSION (`sid`) — only /auth/refresh sets a real limit;
 *            everywhere else it is effectively off.
 */
export function throttlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 60000, limit: 100 },
      {
        name: 'session',
        ttl: 60000,
        limit: 100000,
        getTracker: (req: Record<string, any>) => {
          const sid = req.body?.sid;
          return typeof sid === 'string' && sid
            ? `sid:${sid}`
            : resolveClientIp(req);
        },
      },
    ],
    // Per CLIENT, not per reverse proxy: the default tracker is req.ip, which
    // behind Caddy/cloudflared is the proxy's address for every user, so the
    // whole company shared one bucket (CLIENT_IP_HEADER / TRUST_PROXY).
    getTracker: (req) => resolveClientIp(req),
  };
}

// Stricter per-IP limits for credential / OTP / invitation endpoints (5 requests / minute).
// Names must match a throttlerOptions() definition; we override 'medium'.
export const SENSITIVE_THROTTLE = { medium: { limit: 5, ttl: 60000 } };

/**
 * /auth/refresh: limited per SESSION, not per address. The web app refreshes
 * from its own server (Next.js route on Vercel), so every web user arrived from
 * the same few addresses and shared one 5/min bucket — active users got 429 and
 * were signed out. A refresh token is 256 bits, so the per-address cap only
 * needs to stop floods.
 */
export const REFRESH_THROTTLE = {
  short: { limit: 100, ttl: 1000 },
  medium: { limit: 600, ttl: 60000 },
  session: { limit: 10, ttl: 60000 },
};
