import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's most recent 50 notifications" })
  list(@Req() req: any) {
    return this.notificationsService.listForUser(req.user.sub);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count of unread notifications' })
  async unreadCount(@Req() req: any) {
    const count = await this.notificationsService.countUnread(req.user.sub);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user.sub);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
