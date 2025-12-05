import { Controller, Get, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('v1/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  // Lấy lịch sử 1-1 giữa currentUser và peer
  // Tạm thời demo: truyền luôn currentUser qua query (dev); sau này thay bằng JWT guard
  @Get('history')
  async history(
    @Query('me') me: string,
    @Query('peer') peer: string,
    @Query('limit') limit = '50',
  ) {
    const n = Number(limit) || 50;
    const data = await this.messages.history(me, peer, n);
    return { ok: true, data };
  }
}
