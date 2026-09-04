import { FriendshipSchema, UserBlockSchema } from '@platform/database';

/**
 * Collections that BOTH auth-service (Mongoose, writer) and chat-service (Spring Data, reader)
 * touch in the shared `platform` database. Mongoose derives a collection name from the class name
 * unless `collection` is set explicitly, so a schema that forgets it silently writes somewhere
 * chat-service never reads — the failure is invisible (no error, no log), the feature just stops
 * working. `UserBlock` shipped that way: auth-service wrote `userblocks`, chat-service read
 * `user_blocks`, and blocked users could still send messages and place calls.
 *
 * The expected names below must stay identical to the chat-service annotations:
 *   model/UserBlock.java   → @Document(collection = "user_blocks")
 *   model/Friendship.java  → @Document(collection = "friendships")
 */
describe('cross-service collection names', () => {
  it.each([
    ['UserBlockSchema', UserBlockSchema, 'user_blocks'],
    ['FriendshipSchema', FriendshipSchema, 'friendships'],
  ])('%s writes to the collection chat-service reads', (_name, schema, expected) => {
    expect(schema.get('collection')).toBe(expected);
  });
});
