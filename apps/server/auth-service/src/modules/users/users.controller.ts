import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
  Patch,
  Body,
  Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PasswordChangeService } from './password-change.service';
import { FriendsService } from '../friends/friends.service';
import { AuthCode } from '../../common/auth-code.enum';
import { toPublicProfile } from './public-profile';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordChange: PasswordChangeService,
    private readonly friendsService: FriendsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  async getMe(@Req() req: any) {
    const [user, hasPassword] = await Promise.all([
      this.usersService.findById(req.user.sub),
      this.usersService.getHasPassword(req.user.sub),
    ]);
    if (!user) return null;
    // user is a Mongoose Document — spread via toObject() so we can add hasPassword.
    const doc = user.toObject();
    return {
      ...doc,
      hasPassword,
      // Role is populated on findById; expose the name (null → client shows "Member").
      roleName: (doc.roleId as any)?.name ?? null,
    };
  }

  @Patch('me')
  updateMe(
    @Req() req: any,
    @Body()
    body: {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      coverPhoto?: string;
      dateOfBirth?: string;
      phoneNumber?: string;
      gender?: string;
      hideInfo?: boolean;
      showDateOfBirth?: boolean;
      showPhoneNumber?: boolean;
      showGender?: boolean;
    },
  ) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Post('me/change-password')
  @ApiOperation({
    summary: 'Change (or set a first) password; signs out every OTHER session',
  })
  changePassword(
    @Req() req: any,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    return this.passwordChange.changePassword(
      req.user.sub,
      req.user.sid,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('me/phone/verify')
  @ApiOperation({ summary: 'Verify Firebase Phone Auth token and save phone number' })
  async verifyFirebasePhoneToken(
    @Req() req: any,
    @Body('firebaseIdToken') idToken: string,
  ) {
    if (!idToken) throw new BadRequestException({ code: 'PHONE_TOKEN_MISSING' });
    const user = await this.usersService.verifyFirebasePhoneToken(
      req.user.sub,
      idToken,
    );
    return {
      success: true,
      phoneNumber: user.phoneNumber,
      phoneVerified: user.phoneVerified,
    };
  }

  @Post('device-tokens')
  @ApiOperation({
    summary: 'Register an FCM token (moved off any other account using it)',
  })
  addDeviceToken(@Req() req: any, @Body('token') token: string) {
    return this.usersService.addDeviceToken(req.user.sub, token);
  }

  /**
   * Unregister an FCM token before logout so the device stops receiving this
   * account's pushes. `token` in the JSON body or, for clients that cannot send
   * a DELETE body, `?token=`. Idempotent: 200 even when it was not registered.
   */
  @Delete('device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unregister an FCM token from the caller's account" })
  @ApiQuery({
    name: 'token',
    required: false,
    type: String,
    description: 'FCM token (alternative to the JSON body { token })',
  })
  async removeDeviceToken(
    @Req() req: any,
    @Body('token') bodyToken?: unknown,
    @Query('token') queryToken?: unknown,
  ) {
    const token = [bodyToken, queryToken].find(
      (t): t is string => typeof t === 'string' && t.trim().length > 0,
    );
    if (!token) {
      throw new BadRequestException({ code: AuthCode.DEVICE_TOKEN_REQUIRED });
    }
    await this.usersService.removeDeviceToken(req.user.sub, token);
    return { success: true };
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users by display name, email, or exact phone',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  async search(@Query('q') query: string) {
    const { users, matchedBy } = await this.usersService.findBySearchQuery(
      query ?? '',
    );

    const results = users.map((user) => {
      const doc = user.toObject();
      const result: any = {
        _id: doc._id,
        id: doc._id,
        email: doc.email,
        displayName: doc.displayName,
        avatarUrl: doc.avatarUrl ?? '',
        bio: doc.bio ?? '',
        isVerified: doc.isVerified ?? false,
      };

      // Only surface phoneNumber when the match WAS by phone, so the FE can
      // highlight it. Never leak it on name/email searches.
      if (matchedBy === 'phone') {
        result.phoneNumber = doc.phoneNumber;
        result.matchedBy = 'phone';
      }

      return result;
    });

    return { results, matchedBy };
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

  // Batch profile lookup: `GET /api/users?ids=id1,id2,...` → UserProfile[].
  // Collapses the web client's N+1 `GET /api/users/:id` fan-out (which was
  // tripping the 100 req/min throttler → 429) into one Mongo query.
  // NOTE: declared as the bare '@Get()' so it never collides with '@Get(":id")'
  // (a request with a query string still has an empty path segment).
  @Get()
  @ApiOperation({ summary: 'Batch-fetch user profiles by id' })
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated user ids (max 100)' })
  async findManyByIds(@Req() req: any, @Query('ids') ids?: string) {
    const parsed = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Dedupe while preserving the conventions used elsewhere in the controller.
    const unique = Array.from(new Set(parsed));
    if (unique.length === 0) return [];
    if (unique.length > 100) {
      throw new BadRequestException('Too many ids — max 100 per request');
    }

    const [users, counts] = await Promise.all([
      this.usersService.findManyByIds(unique),
      this.friendsService.countAcceptedForMany(unique),
    ]);

    return users.map((user) =>
      toPublicProfile(user.toObject(), req.user.sub, {
        friendsCount: counts.get(String(user._id)) ?? 0,
      }),
    );
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) return user;
    const [friendsCount, isBlockedByOwner] = await Promise.all([
      this.friendsService.countAccepted(id),
      this.usersService.isBlockedBy(id, req.user.sub),
    ]);
    return toPublicProfile(user.toObject(), req.user.sub, {
      friendsCount,
      isBlockedByOwner,
    });
  }
}
