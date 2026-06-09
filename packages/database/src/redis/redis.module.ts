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
        const client = process.env.REDIS_URL
          ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false })
          : new Redis({
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD,
              lazyConnect: true,
              maxRetriesPerRequest: 0,
              enableOfflineQueue: false,
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