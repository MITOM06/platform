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
    @Body() body: { displayName?: string; avatarUrl?: string; bio?: string; coverPhoto?: string; dateOfBirth?: string; phoneNumber?: string; gender?: string; hideInfo?: boolean },
  ) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Post('me/change-password')
  changePassword(
    @Req() req: any,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    return this.usersService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Post('device-tokens')
  addDeviceToken(@Req() req: any, @Body('token') token: string) {
    return this.usersService.addDeviceToken(req.user.sub, token);
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.usersService.findBySearchQuery(query ?? '');
  }

  @Post('block/:targetId')
  block(@Req() req: any, @Param('targetId') targetId: string) {
    return this.usersService.blockUser(req.user.sub, targetId);
  }

  @Post('unblock/:targetId')
  unblock(@Req() req: any, @Param('targetId') targetId: string) {
    return this.usersService.unblockUser(req.user.sub, targetId);
  }

  // Combined friend + block relationship between the caller and `:id`.
  // Two-segment path, so it never collides with the bare '@Get(":id")' below.
  @Get(':id/relationship')
  async relationship(@Req() req: any, @Param('id') id: string) {
    const [friendStatus, block] = await Promise.all([
      this.friendsService.getStatus(req.user.sub, id),
      this.usersService.getBlockState(req.user.sub, id),
    ]);
    return { friendStatus, ...block };
  }

  // NOTE: must be declared BEFORE the ':id' param route so the two-segment
  // path is not swallowed by '@Get(":id")'.
  @Get('friends/online')
  onlineFriends(@Req() req: any) {
    return this.friendsService.listOnlineFriends(req.user.sub);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) return user;
    const friendsCount = await this.friendsService.countAccepted(id);
    const obj: any = { ...user.toObject(), friendsCount };
    if (req.user.sub !== id && obj.hideInfo) {
      delete obj.email;
      delete obj.phoneNumber;
      delete obj.dateOfBirth;
      delete obj.gender;
      delete obj.bio;
    }
    return obj;
  }
}
