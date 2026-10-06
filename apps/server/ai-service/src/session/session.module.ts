import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiSession, AiSessionSchema } from '@platform/database';
import { AiSessionService } from './ai-session.service';
import { CompactService } from './compact.service';
import { ClaudeClientService } from './claude-client.service';
import { SessionController } from './session.controller';
import { UsageModule } from '../usage/usage.module';

const sessionFeature = MongooseModule.forFeature([
  { name: AiSession.name, schema: AiSessionSchema },
]) as unknown as DynamicModule;

/**
 * AI session persistence (Phase 1) + auto-compaction (Phase 3). Registers the
 * `ai_sessions` model, the session/compact services, and the session REST API.
 * Exports the services so AiService can integrate sessions into the main flow.
 */
@Module({
  // UsageModule: ClaudeClientService records the title/compaction model calls.
  imports: [sessionFeature, UsageModule],
  controllers: [SessionController],
  providers: [AiSessionService, CompactService, ClaudeClientService],
  exports: [AiSessionService, CompactService],
})
export class SessionModule {}
