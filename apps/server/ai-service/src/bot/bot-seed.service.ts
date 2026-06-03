import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class BotSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotSeedService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const botUserId = this.configService.get<string>('config.bot.userId');
    const botDisplayName = this.configService.get<string>('config.bot.displayName');

    await this.connection.collection('users').updateOne(
      { _id: botUserId as any },
      {
        $setOnInsert: {
          _id: botUserId,
          displayName: botDisplayName,
          email: 'ai@platform.internal',
          isBot: true,
          avatarUrl: null,
        },
      },
      { upsert: true },
    );

    this.logger.log(`Bot user ensured: ${botDisplayName} (${botUserId})`);
  }
}
