import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose'; // Nếu dùng Mongoose
import { Connection } from 'mongoose';
import Redis from 'ioredis'; // Giả sử bạn dùng ioredis
import { REDIS_CLIENT } from '@platform/database';
import { Inject } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  async getHealth() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'OK' : 'Disconnected';

    let redisStatus = 'Disconnected';
    try {
      const ping = await this.redis.ping();
      if (ping === 'PONG') redisStatus = 'OK';

    } catch (e) {
      redisStatus = 'Error';
    }

    return {
      status: 'up',
      service: 'auth-service',
      database: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }
}