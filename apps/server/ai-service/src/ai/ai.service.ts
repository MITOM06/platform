import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';

export interface AiRequestPayload {
  conversationId: string;
  userId: string;
  displayName: string;
  content: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
  }

  async handleRequest(payload: AiRequestPayload): Promise<void> {
    this.logger.log(`AI request for conversation ${payload.conversationId} from ${payload.displayName}`);
    // Full streaming implementation in AI-1.4
  }
}
