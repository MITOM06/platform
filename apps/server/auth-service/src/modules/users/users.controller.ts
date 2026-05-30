import { Controller, Get, Param, Query, Req, UseGuards, Patch, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() body: { displayName?: string; avatarUrl?: string }) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.usersService.findBySearchQuery(query ?? '');
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
