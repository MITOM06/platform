import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';


export const REDIS_CLIENT = 'REDIS_CLIENT'; 

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT, 
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class DatabaseRedisModule {}