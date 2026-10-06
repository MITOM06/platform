import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { Friendship, User, UserBlock, REDIS_CLIENT } from '@platform/database';
import { FriendsService } from './friends.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let friendshipModel: any;
  let userModel: any;
  let userBlockModel: any;
  let redis: any;
  let notificationsService: any;

  beforeEach(async () => {
    friendshipModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    userModel = {
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    };
    userBlockModel = {
      // listOnlineFriends awaits this directly (no .exec()), so default to [].
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      exists: jest.fn(),
    };
    redis = { get: jest.fn() };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: getModelToken(Friendship.name), useValue: friendshipModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(UserBlock.name), useValue: userBlockModel },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(FriendsService);
  });

  it('rejects a self friend request', async () => {
    await expect(service.sendRequest('u1', 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects when a friendship already exists', async () => {
    friendshipModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ status: 'pending' }),
    });
    await expect(service.sendRequest('u1', 'u2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a pending request when none exists', async () => {
    friendshipModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    friendshipModel.create.mockResolvedValue({ id: 'f1', status: 'pending' });

    const res = await service.sendRequest('u1', 'u2');

    expect(friendshipModel.create).toHaveBeenCalledWith({
      requesterId: 'u1',
      recipientId: 'u2',
      status: 'pending',
    });
    expect(res).toEqual({ id: 'f1', status: 'pending' });
  });

  it('counts accepted friendships', async () => {
    friendshipModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(3),
    });
    await expect(service.countAccepted('u1')).resolves.toBe(3);
  });

  it('returns only friends that are online in Redis', async () => {
    friendshipModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { requesterId: 'u1', recipientId: 'u2' },
        { requesterId: 'u3', recipientId: 'u1' },
      ]),
    });
    userModel.find.mockReturnValue(usersQuery([
      { _id: 'u2', displayName: 'B' },
      { _id: 'u3', displayName: 'C' },
    ]));
    redis.get.mockImplementation((key: string) =>
      key.endsWith('u2') ? Promise.resolve('online') : Promise.resolve(null),
    );

    const online = await service.listOnlineFriends('u1');

    expect(online.map((u: any) => u._id)).toEqual(['u2']);
  });

  describe('blocks', () => {
    it('403 USER_BLOCKED when sending a request while either side has blocked the other (E2E)', async () => {
      userBlockModel.exists.mockResolvedValue({ _id: 'b1' });
      await expect(service.sendRequest('u1', 'u2')).rejects.toMatchObject({
        status: 403,
        response: { code: 'USER_BLOCKED' },
      });
      expect(userBlockModel.exists).toHaveBeenCalledWith({
        $or: [
          { blockerId: 'u1', blockedId: 'u2' },
          { blockerId: 'u2', blockedId: 'u1' },
        ],
      });
      expect(friendshipModel.create).not.toHaveBeenCalled();
    });

    it('403 USER_BLOCKED when accepting a request across a block', async () => {
      const save = jest.fn();
      friendshipModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ status: 'pending', save }),
      });
      userBlockModel.exists.mockResolvedValue({ _id: 'b1' });
      await expect(service.acceptRequest('u1', 'u2')).rejects.toMatchObject({
        status: 403,
        response: { code: 'USER_BLOCKED' },
      });
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('friend lists use the public-profile projection', () => {
    const friendDoc = {
      _id: 'u2',
      displayName: 'Bob',
      email: 'bob@qc.test',
      avatarUrl: 'a.png',
      phoneNumber: '+84900000000',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      showPhoneNumber: false,
      showDateOfBirth: false,
      showGender: true,
      fcmTokens: ['secret-token'],
      trustedDevices: [{ deviceId: 'd' }],
      socialLinks: { google: 'g-1' },
      status: 'active',
      roleId: 'r1',
    };

    beforeEach(() => {
      friendshipModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ requesterId: 'u1', recipientId: 'u2' }]),
      });
      userModel.find.mockReturnValue(usersQuery([friendDoc]));
    });

    it('never exposes tokens/devices/links and honours the show* toggles (E2E)', async () => {
      const [friend] = await service.listFriends('u1');
      expect(friend).toMatchObject({
        _id: 'u2',
        id: 'u2',
        displayName: 'Bob',
        email: 'bob@qc.test',
        avatarUrl: 'a.png',
        gender: 'male',
      });
      for (const hidden of [
        'fcmTokens',
        'trustedDevices',
        'socialLinks',
        'status',
        'phoneNumber',
        'dateOfBirth',
        'password',
      ]) {
        expect(friend).not.toHaveProperty(hidden);
      }
    });

    it('hideInfo legacy docs hide phone/DOB/gender when no per-field flag is set', async () => {
      userModel.find.mockReturnValue(
        usersQuery([
          {
            _id: 'u2',
            displayName: 'Bob',
            hideInfo: true,
            phoneNumber: '+84900000000',
            gender: 'male',
          },
        ]),
      );
      const [friend] = await service.listFriends('u1');
      expect(friend).not.toHaveProperty('phoneNumber');
      expect(friend).not.toHaveProperty('gender');
    });

    it('drops friends in a block relationship (legacy rows from before block removed friendships)', async () => {
      userBlockModel.find.mockResolvedValue([{ blockerId: 'u2', blockedId: 'u1' }]);
      await expect(service.listFriends('u1')).resolves.toEqual([]);
    });

    it('incoming requests carry the projected requester profile', async () => {
      friendshipModel.find.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: 'f1', requesterId: 'u2', recipientId: 'u1' }]),
      });
      const [req] = await service.listIncomingRequests('u1');
      expect(req.friendshipId).toBe('f1');
      expect(req.requester).toMatchObject({ _id: 'u2', displayName: 'Bob' });
      expect(req.requester).not.toHaveProperty('fcmTokens');
      expect(req.requester).not.toHaveProperty('phoneNumber');
    });
  });
});

/** userModel.find(...).select(...).lean().exec() chain. */
function usersQuery(docs: any[]) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(docs),
      }),
    }),
  };
}
