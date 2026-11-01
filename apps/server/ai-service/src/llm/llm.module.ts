import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClientsService } from './llm-clients.service';
import { ClaudeCliClient } from './claude-cli.client';

/**
 * Model clients (Anthropic + optional OpenRouter light tier), shared app-wide.
 * `ClaudeCliClient` is null unless AI_PROVIDER=claude-cli.
 */
@Global()
@Module({
  providers: [
    LlmClientsService,
    {
      provide: ClaudeCliClient,
      useFactory: (config: ConfigService) => ClaudeCliClient.fromConfig(config),
      inject: [ConfigService],
    },
  ],
  exports: [LlmClientsService, ClaudeCliClient],
})
export class LlmModule {}
