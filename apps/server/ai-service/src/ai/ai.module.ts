import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RedisModule } from '../redis/redis.module';
import { MemoryModule } from '../memory/memory.module';
import { KbModule } from '../kb/kb.module';
import { ToolsModule } from '../tools/tools.module';
import { UsageModule } from '../usage/usage.module';
import { PersonaModule } from '../persona/persona.module';

@Module({
  imports: [RedisModule, MemoryModule, KbModule, ToolsModule, UsageModule, PersonaModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
