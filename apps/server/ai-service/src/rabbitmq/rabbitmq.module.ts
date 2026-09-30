import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { AiConsumer } from '../ai/ai.consumer';
import { AiModule } from '../ai/ai.module';
import { buildRabbitConfig } from './rabbitmq.topology';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: (configService: ConfigService) =>
        buildRabbitConfig(
          configService.get<string>('config.rabbitmqUrl') ?? 'amqp://platform:platform@localhost:5672',
        ),
      inject: [ConfigService],
    }),
    AiModule,
  ],
  providers: [AiConsumer],
})
export class RabbitmqModule {}
