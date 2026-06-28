import {
  Controller,
  Get,
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
import { FriendsService } from '../friends/friends.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
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
    return { ...user.toObject(), hasPassword };
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
  changePassword(
    @Req() req: any,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    return this.usersService.changePassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Post('me/phone/send-otp')
  @ApiOperation({ summary: 'Send SMS OTP to the given phone number' })
  async sendPhoneOtp(@Req() req: any, @Body('phone') phone: string) {
    if (!phone || !phone.startsWith('+')) {
      throw new BadRequestException({ code: 'PHONE_INVALID_FORMAT' });
    }
    await this.usersService.sendPhoneOtp(req.user.sub, phone);
    return { success: true };
  }

  @Post('me/phone/verify')
  @ApiOperation({ summary: 'Verify SMS OTP and save the phone number' })
  async verifyPhoneOtp(@Req() req: any, @Body('otp') otp: string) {
    const user = await this.usersService.verifyPhoneOtp(req.user.sub, otp);
    return {
      success: true,
      phoneNumber: user.phoneNumber,
      phoneVerified: user.phoneVerified,
    };
  }

  @Post('device-tokens')
  addDeviceToken(@Req() req: any, @Body('token') token: string) {
    return this.usersService.addDeviceToken(req.user.sub, token);
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
      this.toProfile(user.toObject(), req.user.sub, counts.get(String(user._id)) ?? 0),
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
    return this.toProfile(user.toObject(), req.user.sub, friendsCount, isBlockedByOwner);
  }

  // Shared public-profile mapping used by both the single (`:id`) and batch
  // endpoints so they return the identical UserProfile DTO shape.
  // NOTE: isBlockedByOwner is only set for single GET /api/users/:id — batch
  // endpoint (findManyByIds) intentionally omits it to avoid breaking
  // conversation participant rendering.
  private toProfile(
    doc: any,
    callerId: string,
    friendsCount: number,
    isBlockedByOwner = false,
  ): any {
    const isSelf = callerId === String(doc._id);

    // Caller is blocked by the profile owner → return minimal public info only.
    // Tells the client to hide action buttons and sensitive profile details.
    if (!isSelf && isBlockedByOwner) {
      return {
        _id: doc._id,
        id: doc._id,
        displayName: doc.displayName,
        avatarUrl: doc.avatarUrl ?? '',
        coverPhoto: doc.coverPhoto ?? '',
        email: doc.email,
        isVerified: doc.isVerified ?? false,
        friendsCount: 0,
        bio: '',
        isBlockedByOwner: true,
      };
    }

    // Explicit public-profile whitelist. NEVER expose fcmTokens, blockedUsers,
    // trustedDevices, socialLinks, status, password, otpCode, otpExpires.
    const profile: any = {
      _id: doc._id,
      id: doc._id,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl ?? '',
      coverPhoto: doc.coverPhoto ?? '',
      isVerified: doc.isVerified ?? false,
      hideInfo: doc.hideInfo ?? false, // legacy fallback safety-net
      createdAt: doc.createdAt,
      friendsCount,
    };

    // Per-field visibility. New per-field flags win; when absent on legacy
    // docs, fall back to the legacy `!hideInfo` behaviour.
    const showDob = doc.showDateOfBirth ?? !doc.hideInfo;
    const showPhone = doc.showPhoneNumber ?? !doc.hideInfo;
    const showGen = doc.showGender ?? !doc.hideInfo;

    // bio is never gated — always public.
    profile.bio = doc.bio;

    if (isSelf) {
      // Self gets everything + the toggle flags to seed the edit form.
      profile.email = doc.email;
      profile.phoneVerified = doc.phoneVerified ?? false;
      profile.showDateOfBirth = showDob;
      profile.showPhoneNumber = showPhone;
      profile.showGender = showGen;
    }

    if (isSelf || showDob) profile.dateOfBirth = doc.dateOfBirth;
    if (isSelf || showPhone) profile.phoneNumber = doc.phoneNumber;
    if (isSelf || showGen) profile.gender = doc.gender;

    return profile;
  }
}
