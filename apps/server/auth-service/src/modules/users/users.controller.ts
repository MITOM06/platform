import { Controller, Get, Param, Query, Req, UseGuards, Patch, Body, Post } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { FriendsService } from '../friends/friends.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly friendsService: FriendsService,
  ) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('me')
  updateMe(
    @Req() req: any,
    @Body() body: { displayName?: string; avatarUrl?: string; bio?: string; coverPhoto?: string },
  ) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Post('device-tokens')
  addDeviceToken(@Req() req: any, @Body('token') token: string) {
    return this.usersService.addDeviceToken(req.user.sub, token);
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.usersService.findBySearchQuery(query ?? '');
  }

  // NOTE: must be declared BEFORE the ':id' param route so the two-segment
  // path is not swallowed by '@Get(":id")'.
  @Get('friends/online')
  onlineFriends(@Req() req: any) {
    return this.friendsService.listOnlineFriends(req.user.sub);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) return user;
    const friendsCount = await this.friendsService.countAccepted(id);
    return { ...user.toObject(), friendsCount };
  }
}
