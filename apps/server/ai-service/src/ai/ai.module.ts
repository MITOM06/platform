import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { RedisModule } from '../redis/redis.module';
import { MemoryModule } from '../memory/memory.module';
import { KbModule } from '../kb/kb.module';
import { ToolsModule } from '../tools/tools.module';
import { UsageModule } from '../usage/usage.module';
import { PersonaModule } from '../persona/persona.module';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [RedisModule, MemoryModule, KbModule, ToolsModule, UsageModule, PersonaModule, SkillsModule],
  controllers: [AiController],
  providers: [AiService, FactExtractorService, ContextBuilderService, ResponseCacheService],
  exports: [AiService],
})
export class AiModule {}
