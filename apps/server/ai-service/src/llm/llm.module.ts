import { Global, Module } from '@nestjs/common';
import { LlmClientsService } from './llm-clients.service';

/** Model clients (Anthropic + optional OpenRouter light tier), shared app-wide. */
@Global()
@Module({
  providers: [LlmClientsService],
  exports: [LlmClientsService],
})
export class LlmModule {}
