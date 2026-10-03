import { Types } from 'mongoose';
import { GetUserInfoTool } from './get-user-info.tool';
import { ToolContext } from './tool.interface';

function makeConnection(users: Array<Record<string, unknown>>) {
  const findOne = jest.fn().mockImplementation(async (q: { _id: unknown }) =>
    // Type-strict like Mongo: an ObjectId _id never equals its hex string.
    users.find((u) => u._id instanceof Types.ObjectId && q._id instanceof Types.ObjectId && u._id.equals(q._id)) ?? null,
  );
  return { connection: { collection: jest.fn().mockReturnValue({ findOne }) } as any, findOne };
}

const ctxFor = (userId: string): ToolContext => ({ conversationId: 'c1', userId, displayName: 'x' });

describe('GetUserInfoTool', () => {
  it('finds the user by ObjectId although the context carries a string id', async () => {
    const oid = new Types.ObjectId();
    const { connection } = makeConnection([
      { _id: oid, displayName: 'Phong Dev', bio: 'Tech Lead', phoneNumber: '+84901000001' },
    ]);
    const result = JSON.parse(await new GetUserInfoTool(connection).execute({}, ctxFor(oid.toHexString())));
    expect(result).toEqual({ displayName: 'Phong Dev', bio: 'Tech Lead', phoneNumber: '+84901000001' });
  });

  it('returns "User not found" without querying for a non-ObjectId id', async () => {
    const { connection, findOne } = makeConnection([]);
    expect(await new GetUserInfoTool(connection).execute({}, ctxFor('extbot:bf-1'))).toBe('User not found');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns "User not found" for an unknown user', async () => {
    const { connection } = makeConnection([]);
    const result = await new GetUserInfoTool(connection).execute({}, ctxFor(new Types.ObjectId().toHexString()));
    expect(result).toBe('User not found');
  });
});
