import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WSEvents } from './events';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    client.emit(WSEvents.CONNECTED, { ok: true });
  }

  @SubscribeMessage(WSEvents.TYPING)
  handleTyping(@MessageBody() payload: { conversationId: string; userId: string }, @ConnectedSocket() client: Socket) {
    client.to(payload.conversationId).emit(WSEvents.TYPING, payload);
  }

  @SubscribeMessage(WSEvents.SEND_MESSAGE)
  async handleSend(@MessageBody() msg: any, @ConnectedSocket() client: Socket) {
    // TODO: persist DB, validate…
    client.to(msg.conversationId).emit(WSEvents.MESSAGE_RECEIVED, msg);
  }
}
