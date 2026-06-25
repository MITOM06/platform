import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotSession, BotSessionSchema } from './bot-session.schema';
import { BotSessionService } from './bot-session.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotSession.name, schema: BotSessionSchema }]),
  ],
  providers: [BotSessionService],
  exports: [BotSessionService],
})
export class BotModule {}
