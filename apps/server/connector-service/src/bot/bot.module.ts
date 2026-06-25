import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotSession, BotSessionSchema } from './bot-session.schema';
import { BotSessionService } from './bot-session.service';
import { BotSessionGuard } from './bot-session.guard';
import { McpServerController } from './mcp-server.controller';
import { BotAdminController } from './bot-admin.controller';
import { InternalBotController } from './internal-bot.controller';
import { InternalModule } from '../internal/internal.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotSession.name, schema: BotSessionSchema }]),
    InternalModule,
  ],
  controllers: [McpServerController, BotAdminController, InternalBotController],
  providers: [BotSessionService, BotSessionGuard],
  exports: [BotSessionService],
})
export class BotModule {}
