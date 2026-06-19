import { Module, Global, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('DatabaseRedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        // Fail-fast options: login/session hot paths await Redis sequentially, so an
        // unreachable / cold (Cloud Run scale-from-zero) / cross-region Redis must NOT
        // hang for ioredis's default ~10s connect cycle. We bound both the initial
        // connect and every individual command so awaited calls error quickly instead
        // of sitting in the offline queue. enableOfflineQueue stays on so commands during
        // a brief reconnect still resolve — but they're now capped by commandTimeout.
        const failFastOptions = {
          lazyConnect: true,
          // Cap initial TCP/handshake; beyond this, connect() rejects instead of retrying silently.
          connectTimeout: 5000,
          // Cap how long any single command waits before rejecting (covers offline-queue stalls).
          commandTimeout: 5000,
          // Allow exactly one retry so a transient blip doesn't instantly error, but never retry forever.
          maxRetriesPerRequest: 1,
          // Keep offline queue so commands during the short reconnect window still resolve (bounded by commandTimeout).
          enableOfflineQueue: true,
          // Bounded reconnect backoff: 200ms, 400ms, ... capped at 2s — avoids a tight reconnect loop and unbounded waits.
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
        };

        const client = process.env.REDIS_URL
          ? new Redis(process.env.REDIS_URL, failFastOptions)
          : new Redis({
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD,
              ...failFastOptions,
            });

        // Must attach error listener — unhandled error event crashes the process
        client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class DatabaseRedisModule {}