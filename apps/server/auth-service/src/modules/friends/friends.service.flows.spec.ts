import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';

/**
 * FriendsService flows not covered by friends.service.spec.ts: batch counts,
 * request / accept side-effects (notifications), status from both sides,
 * remove, and the block / presence filters of the list endpoints.
 */
const exec = (v: unknown) => ({ exec: jest.fn().mockResolvedValue(v) });
const usersQuery = (docs: unknown[]) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue(exec(docs)) }),
});
const selectExec = (v: unknown) => ({ select: jest.fn().mockReturnValue(exec(v)) });

function make() {
  const friendshipModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn().mockReturnValue(exec(null)),
    create: jest.fn(),
    deleteMany: jest.fn().mockReturnValue(exec({ deletedCount: 1 })),
  };
  const userModel = {
    find: jest.fn(),
    findById: jest.fn().mockReturnValue(selectExec(null)),
  };
  const userBlockModel = {
    find: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(null),
  };
  const redis = { get: jest.fn().mockResolvedValue(null) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const svc = new FriendsService(
    friendshipModel as never,
    userModel as never,
    userBlockModel as never,
    redis as never,
    notifications as never,
  );
  return { svc, friendshipModel, userModel, userBlockModel, redis, notifications };
}

describe('FriendsService.countAcceptedForMany', () => {
  it('empty input → empty map without querying', async () => {
    const { svc, friendshipModel } = make();
    await expect(svc.countAcceptedForMany([])).resolves.toEqual(new Map());
    expect(friendshipModel.aggregate).not.toHaveBeenCalled();
  });

  it('keeps only requested ids (the other participant of a friendship is dropped)', async () => {
    const { svc, friendshipModel } = make();
    friendshipModel.aggregate.mockResolvedValue([
      { _id: 'a', count: 2 },
      { _id: 'stranger', count: 9 },
      { _id: 'b', count: 1 },
    ]);
    const out = await svc.countAcceptedForMany(['a', 'b', 'c']);
    expect(out).toEqual(new Map([['a', 2], ['b', 1]]));
    expect(out.has('stranger')).toBe(false);
    const [match] = friendshipModel.aggregate.mock.calls[0][0];
    expect(match.$match.status).toBe('accepted');
    expect(match.$match.$or).toEqual([
      { requesterId: { $in: ['a', 'b', 'c'] } },
      { recipientId: { $in: ['a', 'b', 'c'] } },
    ]);
  });
});

describe('FriendsService.listAcceptedFriendIds', () => {
  it('returns the OTHER participant of each accepted friendship, both directions', async () => {
    const { svc, friendshipModel } = make();
    friendshipModel.find.mockReturnValue(
      exec([
        { requesterId: 'me', recipientId: 'x' },
        { requesterId: 'y', recipientId: 'me' },
      ]),
    );
    await expect(svc.listAcceptedFriendIds('me')).resolves.toEqual(['x', 'y']);
    expect(friendshipModel.find).toHaveBeenCalledWith({
      status: 'accepted',
      $or: [{ requesterId: 'me' }, { recipientId: 'me' }],
    });
  });
});

describe('FriendsService.sendRequest', () => {
  it('already friends → 409 "You are already friends", nothing created', async () => {
    const { svc, friendshipModel } = make();
    friendshipModel.findOne.mockReturnValue(exec({ status: 'accepted' }));
    await expect(svc.sendRequest('u1', 'u2')).rejects.toThrow(
      new ConflictException('You are already friends'),
    );
    expect(friendshipModel.create).not.toHaveBeenCalled();
  });

  it('a reverse pending request (u2 → u1) also blocks a new u1 → u2 request', async () => {
    const { svc, friendshipModel } = make();
    friendshipModel.findOne.mockReturnValue(
      exec({ status: 'pending', requesterId: 'u2', recipientId: 'u1' }),
    );
    await expect(svc.sendRequest('u1', 'u2')).rejects.toThrow(
      'A friend request already exists',
    );
    expect(friendshipModel.findOne).toHaveBeenCalledWith({
      $or: [
        { requesterId: 'u1', recipientId: 'u2' },
        { requesterId: 'u2', recipientId: 'u1' },
      ],
    });
  });

  it('self request is rejected before any DB lookup (no block / friendship query)', async () => {
    const { svc, userBlockModel, friendshipModel } = make();
    await expect(svc.sendRequest('u1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(userBlockModel.exists).not.toHaveBeenCalled();
    expect(friendshipModel.findOne).not.toHaveBeenCalled();
  });

  it('notifies the recipient with the requester display name / avatar', async () => {
    const { svc, friendshipModel, userModel, notifications } = make();
    friendshipModel.create.mockResolvedValue({ _id: 'f1' });
    userModel.findById.mockReturnValue(
      selectExec({ displayName: 'Alice', avatarUrl: 'a.png' }),
    );
    await expect(svc.sendRequest('u1', 'u2')).resolves.toEqual({ _id: 'f1' });
    expect(userModel.findById).toHaveBeenCalledWith('u1');
    expect(notifications.create).toHaveBeenCalledWith({
      recipientId: 'u2',
      type: 'FRIEND_REQUEST',
      title: 'Alice sent you a friend request',
      body: '',
      actorId: 'u1',
      actorName: 'Alice',
      actorAvatarUrl: 'a.png',
      relatedEntityId: 'u1',
    });
  });

  it('requester without avatar → actorAvatarUrl ""; unknown requester → no notification', async () => {
    const { svc, friendshipModel, userModel, notifications } = make();
    friendshipModel.create.mockResolvedValue({ _id: 'f1' });
    userModel.findById.mockReturnValueOnce(selectExec({ displayName: 'Alice' }));
    await svc.sendRequest('u1', 'u2');
    expect(notifications.create.mock.calls[0][0].actorAvatarUrl).toBe('');

    notifications.create.mockClear();
    userModel.findById.mockReturnValueOnce(selectExec(null));
    await svc.sendRequest('u1', 'u3');
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('FriendsService.acceptRequest', () => {
  it('no pending request from that user → 404, block not even checked', async () => {
    const { svc, userBlockModel } = make();
    await expect(svc.acceptRequest('me', 'u2')).rejects.toBeInstanceOf(NotFoundException);
    expect(userBlockModel.exists).not.toHaveBeenCalled();
  });

  it('only a request addressed TO the caller can be accepted (requester cannot self-accept)', async () => {
    const { svc, friendshipModel } = make();
    await expect(svc.acceptRequest('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
    expect(friendshipModel.findOne).toHaveBeenCalledWith({
      requesterId: 'u2',
      recipientId: 'u1',
      status: 'pending',
    });
  });

  it('accepts, saves and notifies the original requester', async () => {
    const { svc, friendshipModel, userModel, notifications } = make();
    const doc: any = { status: 'pending' };
    doc.save = jest.fn().mockImplementation(async () => ({ ...doc }));
    friendshipModel.findOne.mockReturnValue(exec(doc));
    userModel.findById.mockReturnValue(selectExec({ displayName: 'Bob' }));

    const saved = await svc.acceptRequest('me', 'u2');

    expect(saved.status).toBe('accepted');
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(userModel.findById).toHaveBeenCalledWith('me');
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u2',
        type: 'FRIEND_ACCEPTED',
        title: 'Bob accepted your friend request',
        actorId: 'me',
        actorAvatarUrl: '',
        relatedEntityId: 'me',
      }),
    );
  });

  it('blocked → 403 and the friendship stays pending', async () => {
    const { svc, friendshipModel, userBlockModel, notifications } = make();
    const doc: any = { status: 'pending', save: jest.fn() };
    friendshipModel.findOne.mockReturnValue(exec(doc));
    userBlockModel.exists.mockResolvedValue({ _id: 'b' });
    await expect(svc.acceptRequest('me', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(doc.status).toBe('pending');
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('FriendsService.getStatus', () => {
  it('self → none without a lookup', async () => {
    const { svc, friendshipModel } = make();
    await expect(svc.getStatus('u1', 'u1')).resolves.toBe('none');
    expect(friendshipModel.findOne).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'none'],
    [{ status: 'accepted', requesterId: 'u2' }, 'accepted'],
    [{ status: 'pending', requesterId: 'u1' }, 'outgoing'],
    [{ status: 'pending', requesterId: 'u2' }, 'incoming'],
  ])('friendship %p → %s (from u1 point of view)', async (doc, expected) => {
    const { svc, friendshipModel } = make();
    friendshipModel.findOne.mockReturnValue(exec(doc));
    await expect(svc.getStatus('u1', 'u2')).resolves.toBe(expected);
  });
});

describe('FriendsService.removeFriend / isBlockedEitherWay', () => {
  it('deletes the friendship in BOTH directions, scoped to the caller', async () => {
    const { svc, friendshipModel } = make();
    await expect(svc.removeFriend('me', 'u2')).resolves.toBeUndefined();
    expect(friendshipModel.deleteMany).toHaveBeenCalledWith({
      $or: [
        { requesterId: 'me', recipientId: 'u2' },
        { requesterId: 'u2', recipientId: 'me' },
      ],
    });
  });

  it('no block row → false; any row → true', async () => {
    const { svc, userBlockModel } = make();
    await expect(svc.isBlockedEitherWay('a', 'b')).resolves.toBe(false);
    userBlockModel.exists.mockResolvedValue({ _id: 'x' });
    await expect(svc.isBlockedEitherWay('a', 'b')).resolves.toBe(true);
  });
});

describe('FriendsService list filters', () => {
  it('listFriends with no friends → [] without loading users or blocks', async () => {
    const { svc, friendshipModel, userModel, userBlockModel } = make();
    friendshipModel.find.mockReturnValue(exec([]));
    await expect(svc.listFriends('me')).resolves.toEqual([]);
    expect(userModel.find).not.toHaveBeenCalled();
    expect(userBlockModel.find).not.toHaveBeenCalled();
  });

  it('listFriends drops a friend the CALLER blocked (other direction) and keeps the rest', async () => {
    const { svc, friendshipModel, userModel, userBlockModel } = make();
    friendshipModel.find.mockReturnValue(
      exec([
        { requesterId: 'me', recipientId: 'x' },
        { requesterId: 'me', recipientId: 'y' },
      ]),
    );
    userModel.find.mockReturnValue(
      usersQuery([
        { _id: 'x', displayName: 'X' },
        { _id: 'y', displayName: 'Y' },
      ]),
    );
    userBlockModel.find.mockResolvedValue([{ blockerId: 'me', blockedId: 'x' }]);

    const out = await svc.listFriends('me');

    expect(out.map((f) => f._id)).toEqual(['y']);
    expect(userBlockModel.find).toHaveBeenCalledWith({
      $or: [
        { blockerId: 'me', blockedId: { $in: ['x', 'y'] } },
        { blockerId: { $in: ['x', 'y'] }, blockedId: 'me' },
      ],
    });
  });

  it('listFriends tolerates a null block query result', async () => {
    const { svc, friendshipModel, userModel, userBlockModel } = make();
    friendshipModel.find.mockReturnValue(exec([{ requesterId: 'me', recipientId: 'x' }]));
    userModel.find.mockReturnValue(usersQuery([{ _id: 'x' }]));
    userBlockModel.find.mockResolvedValue(null);
    await expect(svc.listFriends('me')).resolves.toHaveLength(1);
  });

  it('listIncomingRequests: none pending → [] without loading users', async () => {
    const { svc, friendshipModel, userModel } = make();
    friendshipModel.find.mockReturnValue(exec([]));
    await expect(svc.listIncomingRequests('me')).resolves.toEqual([]);
    expect(friendshipModel.find).toHaveBeenCalledWith({ recipientId: 'me', status: 'pending' });
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('listIncomingRequests hides requests from blocked or deleted users', async () => {
    const { svc, friendshipModel, userModel, userBlockModel } = make();
    friendshipModel.find.mockReturnValue(
      exec([
        { _id: 'f1', requesterId: 'ok' },
        { _id: 'f2', requesterId: 'blocker' },
        { _id: 'f3', requesterId: 'deleted' },
      ]),
    );
    userModel.find.mockReturnValue(
      usersQuery([
        { _id: 'ok', displayName: 'Ok' },
        { _id: 'blocker', displayName: 'B' },
      ]),
    );
    userBlockModel.find.mockResolvedValue([{ blockerId: 'blocker', blockedId: 'me' }]);

    const out = await svc.listIncomingRequests('me');

    expect(out).toEqual([
      { friendshipId: 'f1', requester: expect.objectContaining({ _id: 'ok' }) },
    ]);
  });

  it('listOnlineFriends: no friends → [] without touching Redis', async () => {
    const { svc, friendshipModel, redis } = make();
    friendshipModel.find.mockReturnValue(exec([]));
    await expect(svc.listOnlineFriends('me')).resolves.toEqual([]);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('listOnlineFriends: nobody online → [] without a block query', async () => {
    const { svc, friendshipModel, userModel, userBlockModel, redis } = make();
    friendshipModel.find.mockReturnValue(exec([{ requesterId: 'me', recipientId: 'x' }]));
    userModel.find.mockReturnValue(usersQuery([{ _id: 'x' }]));
    redis.get.mockResolvedValue('away');
    await expect(svc.listOnlineFriends('me')).resolves.toEqual([]);
    expect(redis.get).toHaveBeenCalledWith('user:status:x');
    expect(userBlockModel.find).not.toHaveBeenCalled();
  });

  it('listOnlineFriends hides an ONLINE friend who blocked the caller', async () => {
    const { svc, friendshipModel, userModel, userBlockModel, redis } = make();
    friendshipModel.find.mockReturnValue(
      exec([
        { requesterId: 'me', recipientId: 'x' },
        { requesterId: 'me', recipientId: 'y' },
      ]),
    );
    userModel.find.mockReturnValue(usersQuery([{ _id: 'x' }, { _id: 'y' }]));
    redis.get.mockResolvedValue('online');
    userBlockModel.find.mockResolvedValue([{ blockerId: 'x', blockedId: 'me' }]);

    const out = await svc.listOnlineFriends('me');

    expect(out.map((f) => f._id)).toEqual(['y']);
  });
});
