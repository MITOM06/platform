import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Friendship,
  FriendshipDocument,
  User,
  UserDocument,
  UserBlock,
  UserBlockDocument,
  REDIS_CLIENT,
  Redis,
} from '@platform/database';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthCode } from '../../common/auth-code.enum';
import { toPublicProfile } from '../users/public-profile';

// Redis key written by chat-service PresenceEventListener (value "online", 5-min TTL).
const STATUS_KEY_PREFIX = 'user:status:';

/** A friend as returned to clients: the shared public profile (+ email). */
export type FriendProfile = Record<string, unknown> & { _id: unknown };

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(Friendship.name)
    private friendshipModel: Model<FriendshipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserBlock.name)
    private readonly userBlockModel: Model<UserBlockDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Count accepted friendships the user participates in (either direction). */
  async countAccepted(userId: string): Promise<number> {
    return this.friendshipModel
      .countDocuments({
        status: 'accepted',
        $or: [{ requesterId: userId }, { recipientId: userId }],
      })
      .exec();
  }

  /**
   * Accepted-friendship counts for many users in a single aggregation.
   * Returns a Map keyed by userId → count (missing ids default to 0 at the
   * call site). Each accepted friendship is counted once for each of its two
   * participants that appear in `userIds`.
   */
  async countAcceptedForMany(userIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (userIds.length === 0) return result;
    const idSet = new Set(userIds);

    const rows = await this.friendshipModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          status: 'accepted',
          $or: [
            { requesterId: { $in: userIds } },
            { recipientId: { $in: userIds } },
          ],
        },
      },
      // Emit one row per participant, then keep only the requested ids.
      { $project: { participants: ['$requesterId', '$recipientId'] } },
      { $unwind: '$participants' },
      { $group: { _id: '$participants', count: { $sum: 1 } } },
    ]);

    for (const row of rows) {
      if (idSet.has(row._id)) result.set(row._id, row.count);
    }
    return result;
  }

  /** Ids of every user who is an accepted friend of `userId`. */
  async listAcceptedFriendIds(userId: string): Promise<string[]> {
    const docs = await this.friendshipModel
      .find({
        status: 'accepted',
        $or: [{ requesterId: userId }, { recipientId: userId }],
      })
      .exec();
    return docs.map((d) =>
      d.requesterId === userId ? d.recipientId : d.requesterId,
    );
  }

  /**
   * Accepted friends as public profiles (same privacy rules as
   * GET /api/users/:id: show* toggles honoured, no tokens/devices/links),
   * excluding anyone in a block relationship with `userId` (legacy rows —
   * blocking now deletes the friendship).
   */
  async listFriends(userId: string): Promise<FriendProfile[]> {
    const docs = await this.excludeBlocked(userId, await this.friendDocs(userId));
    return docs.map((d) => this.toFriend(d, userId));
  }

  /** Pending friend requests addressed TO `userId` (incoming), with requester profile. */
  async listIncomingRequests(
    userId: string,
  ): Promise<Array<{ friendshipId: string; requester: FriendProfile }>> {
    const docs = await this.friendshipModel
      .find({
        recipientId: userId,
        status: 'pending',
      })
      .exec();
    const requesterIds = docs.map((d) => d.requesterId);
    if (requesterIds.length === 0) return [];
    const users = await this.excludeBlocked(
      userId,
      await this.userModel
        .find({ _id: { $in: requesterIds } })
        .select('-password')
        .lean()
        .exec(),
    );
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return docs
      .map((d) => {
        const requester = byId.get(d.requesterId);
        if (!requester) return null;
        return {
          friendshipId: String(d._id),
          requester: this.toFriend(requester, userId),
        };
      })
      .filter((x): x is { friendshipId: string; requester: FriendProfile } => x !== null);
  }

  /** Accepted friends that are currently online (Redis presence).
   *  Excludes anyone who has a block relationship with `userId` in either
   *  direction — neither party should see the other as online.
   */
  async listOnlineFriends(userId: string): Promise<FriendProfile[]> {
    const friends = await this.friendDocs(userId);
    if (friends.length === 0) return [];
    const statuses = await Promise.all(
      friends.map((f) => this.redis.get(STATUS_KEY_PREFIX + String(f._id))),
    );
    const onlineFriends = friends.filter((_, i) => statuses[i] === 'online');
    if (onlineFriends.length === 0) return [];
    const visible = await this.excludeBlocked(userId, onlineFriends);
    return visible.map((d) => this.toFriend(d, userId));
  }

  private async friendDocs(userId: string): Promise<any[]> {
    const ids = await this.listAcceptedFriendIds(userId);
    if (ids.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: ids } })
      .select('-password')
      .lean()
      .exec();
  }

  private toFriend(doc: any, callerId: string): FriendProfile {
    return toPublicProfile(doc, callerId, { includeEmail: true }) as FriendProfile;
  }

  /** Drop users that blocked `userId` or were blocked by `userId`. */
  private async excludeBlocked<T extends { _id: unknown }>(
    userId: string,
    users: T[],
  ): Promise<T[]> {
    if (users.length === 0) return users;
    const ids = users.map((u) => String(u._id));
    const blocks = await this.userBlockModel.find({
      $or: [
        { blockerId: userId, blockedId: { $in: ids } },
        { blockerId: { $in: ids }, blockedId: userId },
      ],
    });
    if (!blocks || blocks.length === 0) return users;
    const blocked = new Set<string>();
    for (const b of blocks) {
      blocked.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return users.filter((u) => !blocked.has(String(u._id)));
  }

  /** Whether either user has blocked the other. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const hit = await this.userBlockModel.exists({
      $or: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
    return !!hit;
  }

  /** Returns the friendship doc between two users (either direction), if any. */
  async findBetween(a: string, b: string): Promise<FriendshipDocument | null> {
    return this.friendshipModel
      .findOne({
        $or: [
          { requesterId: a, recipientId: b },
          { requesterId: b, recipientId: a },
        ],
      })
      .exec();
  }

  /** Create a pending friend request from `requesterId` to `recipientId`. */
  async sendRequest(
    requesterId: string,
    recipientId: string,
  ): Promise<FriendshipDocument> {
    if (requesterId === recipientId) {
      throw new ConflictException('Cannot send a friend request to yourself');
    }
    if (await this.isBlockedEitherWay(requesterId, recipientId)) {
      throw new ForbiddenException({ code: AuthCode.USER_BLOCKED });
    }
    const existing = await this.findBetween(requesterId, recipientId);
    if (existing) {
      throw new ConflictException(
        existing.status === 'accepted'
          ? 'You are already friends'
          : 'A friend request already exists',
      );
    }
    const friendship = await this.friendshipModel.create({
      requesterId,
      recipientId,
      status: 'pending',
    });

    // Notify the recipient about the incoming friend request.
    // Fetch the requester's profile for display.
    const requesterDoc = await this.userModel
      .findById(requesterId)
      .select('displayName avatarUrl')
      .exec();

    if (requesterDoc) {
      await this.notificationsService.create({
        recipientId,
        type: 'FRIEND_REQUEST',
        title: `${requesterDoc.displayName} sent you a friend request`,
        body: '',
        actorId: requesterId,
        actorName: requesterDoc.displayName,
        actorAvatarUrl: (requesterDoc as any).avatarUrl ?? '',
        relatedEntityId: requesterId,
      });
    }

    return friendship;
  }

  /** Accept a pending request sent by `requesterId` to the current user. */
  async acceptRequest(
    currentUserId: string,
    requesterId: string,
  ): Promise<FriendshipDocument> {
    const doc = await this.friendshipModel
      .findOne({
        requesterId,
        recipientId: currentUserId,
        status: 'pending',
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('No pending friend request from this user');
    }
    if (await this.isBlockedEitherWay(currentUserId, requesterId)) {
      throw new ForbiddenException({ code: AuthCode.USER_BLOCKED });
    }
    doc.status = 'accepted';
    const saved = await doc.save();

    // Notify the original requester that their request was accepted.
    const accepterDoc = await this.userModel
      .findById(currentUserId)
      .select('displayName avatarUrl')
      .exec();

    if (accepterDoc) {
      await this.notificationsService.create({
        recipientId: requesterId,
        type: 'FRIEND_ACCEPTED',
        title: `${accepterDoc.displayName} accepted your friend request`,
        body: '',
        actorId: currentUserId,
        actorName: accepterDoc.displayName,
        actorAvatarUrl: (accepterDoc as any).avatarUrl ?? '',
        relatedEntityId: currentUserId,
      });
    }

    return saved;
  }

  /**
   * Friendship status between the current user and `otherId`, from the current
   * user's point of view:
   *   - `none`     — no relationship
   *   - `outgoing` — current user sent a pending request
   *   - `incoming` — current user received a pending request
   *   - `accepted` — they are friends
   */
  async getStatus(
    currentUserId: string,
    otherId: string,
  ): Promise<'none' | 'outgoing' | 'incoming' | 'accepted'> {
    if (currentUserId === otherId) return 'none';
    const doc = await this.findBetween(currentUserId, otherId);
    if (!doc) return 'none';
    if (doc.status === 'accepted') return 'accepted';
    return doc.requesterId === currentUserId ? 'outgoing' : 'incoming';
  }

  /** Remove any friendship (accepted OR pending) between the two users. */
  async removeFriend(currentUserId: string, otherId: string): Promise<void> {
    await this.friendshipModel
      .deleteMany({
        $or: [
          { requesterId: currentUserId, recipientId: otherId },
          { requesterId: otherId, recipientId: currentUserId },
        ],
      })
      .exec();
  }
}
