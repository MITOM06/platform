// nanoid is ESM-only (pulled in via PasswordChangeService → SessionService).
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersController } from './users.controller';

const CALLER = 'u-caller';
const req = { user: { sub: CALLER, sid: 's1' } };

/** Minimal Mongoose document: toObject() returns the plain fields. */
const docOf = (fields: Record<string, unknown>) => ({
  _id: fields._id,
  toObject: () => ({ ...fields }),
});

function make() {
  const usersService = {
    updateProfile: jest.fn().mockResolvedValue({ _id: CALLER }),
    verifyFirebasePhoneToken: jest.fn(),
    addDeviceToken: jest.fn().mockResolvedValue(undefined),
    findBySearchQuery: jest.fn(),
    blockUser: jest.fn().mockResolvedValue({ success: true }),
    unblockUser: jest.fn().mockResolvedValue({ success: true }),
    getBlockState: jest.fn(),
    findManyByIds: jest.fn(),
    getRoleNameMap: jest.fn(),
    findById: jest.fn(),
    isBlockedBy: jest.fn().mockResolvedValue(false),
    getRoleName: jest.fn().mockResolvedValue('Member'),
  };
  const friendsService = {
    getStatus: jest.fn(),
    listOnlineFriends: jest.fn(),
    countAcceptedForMany: jest.fn(),
    countAccepted: jest.fn().mockResolvedValue(0),
  };
  const ctrl = new UsersController(
    usersService as never,
    {} as never,
    friendsService as never,
    {} as never,
    {} as never,
  );
  return { ctrl, usersService, friendsService };
}

describe('UsersController — profile writes', () => {
  it('PATCH /me updates the CALLER (id from the token, never the body)', async () => {
    const { ctrl, usersService } = make();
    const body = { displayName: 'Bob' };
    await expect(ctrl.updateMe(req, body)).resolves.toEqual({ _id: CALLER });
    expect(usersService.updateProfile).toHaveBeenCalledWith(CALLER, body);
  });

  it('POST /me/phone/verify returns only success + phone fields', async () => {
    const { ctrl, usersService } = make();
    usersService.verifyFirebasePhoneToken.mockResolvedValue({
      phoneNumber: '+84901234567',
      phoneVerified: true,
      password: 'hash',
    });
    await expect(ctrl.verifyFirebasePhoneToken(req, 'tok')).resolves.toEqual({
      success: true,
      phoneNumber: '+84901234567',
      phoneVerified: true,
    });
    expect(usersService.verifyFirebasePhoneToken).toHaveBeenCalledWith(
      CALLER,
      'tok',
    );
  });

  it('POST /me/phone/verify without a token → 400 PHONE_TOKEN_MISSING, no service call', async () => {
    const { ctrl, usersService } = make();
    await expect(ctrl.verifyFirebasePhoneToken(req, '')).rejects.toMatchObject({
      status: 400,
      response: { code: 'PHONE_TOKEN_MISSING' },
    });
    expect(usersService.verifyFirebasePhoneToken).not.toHaveBeenCalled();
  });

  it('POST /device-tokens registers the token on the caller', async () => {
    const { ctrl, usersService } = make();
    await ctrl.addDeviceToken(req, 'fcm-1');
    expect(usersService.addDeviceToken).toHaveBeenCalledWith(CALLER, 'fcm-1');
  });
});

describe('UsersController.search', () => {
  it('name/email match: whitelisted fields only, phone NEVER included', async () => {
    const { ctrl, usersService } = make();
    usersService.findBySearchQuery.mockResolvedValue({
      matchedBy: 'name_email',
      users: [
        docOf({
          _id: 'u2',
          email: 'bob@x.io',
          displayName: 'Bob',
          phoneNumber: '+84901234567',
          fcmTokens: ['t'],
        }),
      ],
    });
    await expect(ctrl.search('bob')).resolves.toEqual({
      matchedBy: 'name_email',
      results: [
        {
          _id: 'u2',
          id: 'u2',
          email: 'bob@x.io',
          displayName: 'Bob',
          avatarUrl: '',
          bio: '',
          isVerified: false,
        },
      ],
    });
  });

  it('phone match: exposes the matched number and tags the row', async () => {
    const { ctrl, usersService } = make();
    usersService.findBySearchQuery.mockResolvedValue({
      matchedBy: 'phone',
      users: [
        docOf({ _id: 'u2', phoneNumber: '+84901234567', isVerified: true }),
      ],
    });
    const { results } = await ctrl.search('0901234567');
    expect(results[0]).toMatchObject({
      phoneNumber: '+84901234567',
      matchedBy: 'phone',
      isVerified: true,
    });
  });

  it('missing ?q is passed as an empty string (service returns nothing)', async () => {
    const { ctrl, usersService } = make();
    usersService.findBySearchQuery.mockResolvedValue({
      matchedBy: 'name_email',
      users: [],
    });
    await expect(ctrl.search(undefined as unknown as string)).resolves.toEqual({
      results: [],
      matchedBy: 'name_email',
    });
    expect(usersService.findBySearchQuery).toHaveBeenCalledWith('');
  });
});

describe('UsersController — block / relationship / friends', () => {
  it('block and unblock act from the caller to the target', async () => {
    const { ctrl, usersService } = make();
    await expect(ctrl.block(req, 'u2')).resolves.toEqual({ success: true });
    await expect(ctrl.unblock(req, 'u2')).resolves.toEqual({ success: true });
    expect(usersService.blockUser).toHaveBeenCalledWith(CALLER, 'u2');
    expect(usersService.unblockUser).toHaveBeenCalledWith(CALLER, 'u2');
  });

  it('self-block 409 from the service reaches the client', async () => {
    const { ctrl, usersService } = make();
    usersService.blockUser.mockRejectedValue(
      new ConflictException({ code: 'CANNOT_BLOCK_SELF' }),
    );
    await expect(ctrl.block(req, CALLER)).rejects.toThrow(ConflictException);
  });

  it('GET /:id/relationship merges friend status and both block directions', async () => {
    const { ctrl, usersService, friendsService } = make();
    friendsService.getStatus.mockResolvedValue('accepted');
    usersService.getBlockState.mockResolvedValue({
      iBlocked: true,
      blockedMe: false,
    });
    await expect(ctrl.relationship(req, 'u2')).resolves.toEqual({
      friendStatus: 'accepted',
      iBlocked: true,
      blockedMe: false,
    });
    expect(friendsService.getStatus).toHaveBeenCalledWith(CALLER, 'u2');
    expect(usersService.getBlockState).toHaveBeenCalledWith(CALLER, 'u2');
  });

  it("GET /friends/online lists the caller's online friends", async () => {
    const { ctrl, friendsService } = make();
    friendsService.listOnlineFriends.mockResolvedValue([{ id: 'u2' }]);
    await expect(ctrl.onlineFriends(req)).resolves.toEqual([{ id: 'u2' }]);
    expect(friendsService.listOnlineFriends).toHaveBeenCalledWith(CALLER);
  });
});

describe('UsersController.findManyByIds (batch profiles)', () => {
  it.each([[undefined], [''], [' , ,']])(
    'no usable ids (%p) → [] without querying',
    async (ids) => {
      const { ctrl, usersService } = make();
      await expect(ctrl.findManyByIds(req, ids)).resolves.toEqual([]);
      expect(usersService.findManyByIds).not.toHaveBeenCalled();
    },
  );

  it('more than 100 distinct ids → 400', async () => {
    const { ctrl, usersService } = make();
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`).join(',');
    await expect(ctrl.findManyByIds(req, ids)).rejects.toThrow(
      BadRequestException,
    );
    expect(usersService.findManyByIds).not.toHaveBeenCalled();
  });

  it('exactly 100 ids after dedupe is allowed (duplicates do not count)', async () => {
    const { ctrl, usersService, friendsService } = make();
    usersService.findManyByIds.mockResolvedValue([]);
    friendsService.countAcceptedForMany.mockResolvedValue(new Map());
    usersService.getRoleNameMap.mockResolvedValue(new Map());
    const ids = Array.from({ length: 100 }, (_, i) => `id${i}`);
    await expect(
      ctrl.findManyByIds(req, [...ids, 'id0', 'id1'].join(',')),
    ).resolves.toEqual([]);
    expect(usersService.findManyByIds).toHaveBeenCalledWith(ids);
  });

  it('trims + dedupes ids and fills friendsCount / roleName per user (fallbacks 0 / Member)', async () => {
    const { ctrl, usersService, friendsService } = make();
    usersService.findManyByIds.mockResolvedValue([
      docOf({ _id: 'a', displayName: 'A', roleId: 'r1' }),
      docOf({ _id: 'b', displayName: 'B' }),
    ]);
    friendsService.countAcceptedForMany.mockResolvedValue(new Map([['a', 3]]));
    usersService.getRoleNameMap.mockResolvedValue(new Map([['r1', 'Admin']]));

    const out = await ctrl.findManyByIds(req, ' a, b ,a');

    expect(usersService.findManyByIds).toHaveBeenCalledWith(['a', 'b']);
    expect(friendsService.countAcceptedForMany).toHaveBeenCalledWith([
      'a',
      'b',
    ]);
    expect(out).toEqual([
      expect.objectContaining({ id: 'a', friendsCount: 3, roleName: 'Admin' }),
      expect.objectContaining({ id: 'b', friendsCount: 0, roleName: 'Member' }),
    ]);
    // Public profile of someone else: never the email.
    expect(out[0]).not.toHaveProperty('email');
  });
});

describe('UsersController.findById (single profile)', () => {
  it('unknown id → null body (current contract), no follow-up queries', async () => {
    const { ctrl, usersService, friendsService } = make();
    usersService.findById.mockResolvedValue(null);
    await expect(ctrl.findById(req, 'missing')).resolves.toBeNull();
    expect(friendsService.countAccepted).not.toHaveBeenCalled();
    expect(usersService.isBlockedBy).not.toHaveBeenCalled();
  });

  it('another member: public profile with friendsCount + roleName, no email', async () => {
    const { ctrl, usersService, friendsService } = make();
    usersService.findById.mockResolvedValue(
      docOf({ _id: 'u2', displayName: 'Bob', email: 'bob@x.io', roleId: 'r1' }),
    );
    friendsService.countAccepted.mockResolvedValue(5);
    usersService.getRoleName.mockResolvedValue('Admin');

    const out = await ctrl.findById(req, 'u2');

    expect(out).toMatchObject({ id: 'u2', friendsCount: 5, roleName: 'Admin' });
    expect(out).not.toHaveProperty('email');
    expect(usersService.isBlockedBy).toHaveBeenCalledWith('u2', CALLER);
    expect(usersService.getRoleName).toHaveBeenCalledWith('r1');
  });

  it('owner blocked the caller → minimal view flagged isBlockedByOwner, bio and counts hidden', async () => {
    const { ctrl, usersService, friendsService } = make();
    usersService.findById.mockResolvedValue(
      docOf({
        _id: 'u2',
        displayName: 'Bob',
        bio: 'secret',
        phoneNumber: '+84',
      }),
    );
    friendsService.countAccepted.mockResolvedValue(9);
    usersService.isBlockedBy.mockResolvedValue(true);

    const out = await ctrl.findById(req, 'u2');

    expect(out).toMatchObject({
      isBlockedByOwner: true,
      friendsCount: 0,
      bio: '',
    });
    expect(out).not.toHaveProperty('phoneNumber');
  });

  // BUG: toPublicProfile's blocked branch returns `email: doc.email`, so a caller
  // the owner BLOCKED sees the owner's email, while a non-blocked member does
  // not (the normal profile path omits email for non-self callers). Blocking
  // should never reveal MORE than the normal view. Fix lives in
  // src/modules/users/public-profile.ts (out of scope for this test-only task).
  it.skip('BUG: owner blocked the caller → the blocked view must NOT expose the email', async () => {
    const { ctrl, usersService } = make();
    usersService.findById.mockResolvedValue(
      docOf({ _id: 'u2', displayName: 'Bob', email: 'bob@x.io' }),
    );
    usersService.isBlockedBy.mockResolvedValue(true);
    const out = await ctrl.findById(req, 'u2');
    expect(out).not.toHaveProperty('email');
  });
});
