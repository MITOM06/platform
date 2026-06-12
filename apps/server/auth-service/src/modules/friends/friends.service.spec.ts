import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { Friendship, User, REDIS_CLIENT } from '@platform/database';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let friendshipModel: any;
  let userModel: any;
  let redis: any;

  beforeEach(async () => {
    friendshipModel = {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    userModel = { find: jest.fn() };
    redis = { get: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: getModelToken(Friendship.name), useValue: friendshipModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: REDIS_CLIENT, useValue: redis },
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
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'u2', displayName: 'B' },
          { _id: 'u3', displayName: 'C' },
        ]),
      }),
    });
    redis.get.mockImplementation((key: string) =>
      key.endsWith('u2') ? Promise.resolve('online') : Promise.resolve(null),
    );

    const online = await service.listOnlineFriends('u1');

    expect(online.map((u: any) => u._id)).toEqual(['u2']);
  });
});
