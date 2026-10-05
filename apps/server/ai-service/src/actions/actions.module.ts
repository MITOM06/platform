import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ToolsModule } from '../tools/tools.module';
import { PersonaModule } from '../persona/persona.module';
import { UsageModule } from '../usage/usage.module';
import { SettingsModule } from '../settings/settings.module';
import { SessionModule } from '../session/session.module';
import { ActionsController } from './actions.controller';
import { PendingActionStore } from './pending-action.store';
import { PendingActionService } from './pending-action.service';
import { ActionFollowUpService } from './action-follow-up.service';

/**
 * Pending AI actions — sensitive connector writes held for the requester's
 * in-chat confirmation (CONTRACTS-ROUND2 §F2). Exports the store so the
 * agentic loop (AiModule) can stage actions instead of executing them.
 */
@Module({
  imports: [RedisModule, ToolsModule, PersonaModule, UsageModule, SettingsModule, SessionModule],
  controllers: [ActionsController],
  providers: [PendingActionStore, PendingActionService, ActionFollowUpService],
  exports: [PendingActionStore],
})
export class ActionsModule {}
