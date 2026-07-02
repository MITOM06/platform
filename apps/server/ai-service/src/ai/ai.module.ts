import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { RedisModule } from '../redis/redis.module';
import { MemoryModule } from '../memory/memory.module';
import { KbModule } from '../kb/kb.module';
import { ToolsModule } from '../tools/tools.module';
import { UsageModule } from '../usage/usage.module';
import { PersonaModule } from '../persona/persona.module';
import { SessionModule } from '../session/session.module';
import { SkillsModule } from '../skills/skills.module';
import { ConversationModule } from '../conversation/conversation.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    RedisModule,
    MemoryModule,
    KbModule,
    ToolsModule,
    UsageModule,
    PersonaModule,
    SessionModule,
    SkillsModule,
    ConversationModule,
    // AiService injects SettingsService (workspace AI settings, TASK-12); without
    // importing SettingsModule (which exports it) Nest can't resolve it → the
    // container crashes at boot and the Cloud Run revision never listens.
    SettingsModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    FactExtractorService,
    ContextBuilderService,
    ResponseCacheService,
    ChatImageService,
  ],
  exports: [AiService],
})
export class AiModule {}
