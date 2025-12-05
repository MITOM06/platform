import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

@WebSocketGateway({ cors: { origin: '*' } })
export class WsGateway {
  @WebSocketServer() server: Server;

  constructor(private messages: MessagesService) {}

  async afterInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    this.server.adapter(createAdapter(pubClient, subClient));
  }

  @SubscribeMessage('join')
  onJoin(@MessageBody() userId: string, @ConnectedSocket() socket: Socket) {
    socket.data.userId = userId;
    socket.join(userId);            // room = userId
    socket.emit('joined', { userId });
  }

  @SubscribeMessage('send')
  async onSend(
    @MessageBody() payload: { to: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const from = socket.data.userId;
    if (!from) {
      socket.emit('error', { message: 'You must join first' });
      return;
    }
    const msg = await this.messages.send(from, payload.to, payload.content);
    this.server.to(payload.to).emit('message', msg); // đẩy cho người nhận
    socket.emit('message', msg);                      // echo người gửi
  }
}
