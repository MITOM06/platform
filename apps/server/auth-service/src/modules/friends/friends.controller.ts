import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendsService } from './friends.service';
import { FriendRequestDto } from './dto/friend-request.dto';
import { AcceptFriendDto } from './dto/accept-friend.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('api/friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  request(@Req() req: any, @Body() body: FriendRequestDto) {
    return this.friendsService.sendRequest(req.user.sub, body.recipientId);
  }

  @Put('accept')
  accept(@Req() req: any, @Body() body: AcceptFriendDto) {
    return this.friendsService.acceptRequest(req.user.sub, body.requesterId);
  }

  @Get()
  list(@Req() req: any) {
    return this.friendsService.listFriends(req.user.sub);
  }

  @Get('requests')
  requests(@Req() req: any) {
    return this.friendsService.listIncomingRequests(req.user.sub);
  }

  // NOTE: literal path 'status/:userId' is fine — there is no bare ':id' route
  // on this controller, so no ordering conflict.
  @Get('status/:userId')
  async status(@Req() req: any, @Param('userId') userId: string) {
    return { status: await this.friendsService.getStatus(req.user.sub, userId) };
  }

  /** Unfriend or cancel/decline a pending request (either direction). */
  @Delete(':userId')
  async remove(@Req() req: any, @Param('userId') userId: string) {
    await this.friendsService.removeFriend(req.user.sub, userId);
    return { success: true };
  }
}
