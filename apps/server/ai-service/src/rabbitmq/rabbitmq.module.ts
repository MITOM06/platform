import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AiConsumer } from '../ai/ai.consumer';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('config.rabbitmqUrl') ?? 'amqp://platform:platform@localhost:5672',
        exchanges: [
          { name: 'ai.direct', type: 'direct' },
        ],
        queues: [
          {
            name: 'ai.requests',
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'ai.dead-letter',
                'x-dead-letter-routing-key': 'dlq',
                'x-message-ttl': 30_000,
              },
            },
          },
        ],
        connectionInitOptions: { wait: false },
      }),
      inject: [ConfigService],
    }),
    AiModule,
  ],
  providers: [AiConsumer],
})
export class RabbitmqModule {}
