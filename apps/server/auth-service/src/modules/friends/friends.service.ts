import {
  ConflictException,
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
  REDIS_CLIENT,
  Redis,
} from '@platform/database';
import { NotificationsService } from '../notifications/notifications.service';

// Redis key written by chat-service PresenceEventListener (value "online", 5-min TTL).
const STATUS_KEY_PREFIX = 'user:status:';

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(Friendship.name)
    private friendshipModel: Model<FriendshipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  /** Accepted friends resolved to public user profiles (password excluded). */
  async listFriends(userId: string): Promise<UserDocument[]> {
    const ids = await this.listAcceptedFriendIds(userId);
    if (ids.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: ids } })
      .select('-password')
      .exec();
  }

  /** Pending friend requests addressed TO `userId` (incoming), with requester profile. */
  async listIncomingRequests(userId: string): Promise<any[]> {
    const docs = await this.friendshipModel
      .find({
        recipientId: userId,
        status: 'pending',
      })
      .exec();
    const requesterIds = docs.map((d) => d.requesterId);
    if (requesterIds.length === 0) return [];
    const users = await this.userModel
      .find({ _id: { $in: requesterIds } })
      .select('-password')
      .exec();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    return docs
      .map((d) => {
        const requester = byId.get(d.requesterId);
        if (!requester) return null;
        return { friendshipId: String(d._id), requester };
      })
      .filter((x) => x !== null);
  }

  /** Accepted friends that are currently online (Redis presence). */
  async listOnlineFriends(userId: string): Promise<UserDocument[]> {
    const friends = await this.listFriends(userId);
    if (friends.length === 0) return [];
    const statuses = await Promise.all(
      friends.map((f) => this.redis.get(STATUS_KEY_PREFIX + String(f._id))),
    );
    return friends.filter((_, i) => statuses[i] === 'online');
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
