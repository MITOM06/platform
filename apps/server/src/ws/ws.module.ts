import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [MessagesModule],
  providers: [WsGateway],
})
export class WsModule {}
