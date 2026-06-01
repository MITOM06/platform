import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
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
}
