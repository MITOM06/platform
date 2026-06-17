import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { AiService, AiRequestPayload } from './ai.service';

@Injectable()
export class AiConsumer {
  private readonly logger = new Logger(AiConsumer.name);

  constructor(private readonly aiService: AiService) {}

  @RabbitSubscribe({
    exchange: 'ai.direct',
    routingKey: 'ai.request',
    queue: 'ai.requests',
  })
  async handleAiRequest(payload: AiRequestPayload): Promise<void> {
    try {
      await this.aiService.handleRequest(payload);
    } catch (err) {
      this.logger.error(`Failed to process AI request for conversation ${payload.conversationId}`, err);
    }
  }
}
