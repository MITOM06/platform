import { Types } from 'mongoose';
import { resolveDisplayNames, userIdQueryValues } from './user-names';

const OID = '507f1f77bcf86cd799439011';

describe('userIdQueryValues', () => {
  it('queries a 24-hex id as both string and ObjectId, bots as string only, deduped, blanks dropped', () => {
    const out = userIdQueryValues([OID, OID, 'ai-bot-x', '', '  ', 5 as unknown as string]);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(OID);
    expect(out[1]).toBeInstanceOf(Types.ObjectId);
    expect(String(out[1])).toBe(OID);
    expect(out[2]).toBe('ai-bot-x');
  });
});

describe('resolveDisplayNames', () => {
  function conn(docs: unknown[] | Error) {
    const toArray = docs instanceof Error ? jest.fn().mockRejectedValue(docs) : jest.fn().mockResolvedValue(docs);
    const find = jest.fn().mockReturnValue({ toArray });
    const collection = jest.fn().mockReturnValue({ find });
    return { connection: { collection } as never, collection, find };
  }

  it('maps resolved ids to trimmed names and omits blank / non-string names', async () => {
    const c = conn([
      { _id: new Types.ObjectId(OID), displayName: ' Alice ' },
      { _id: 'ai-bot-x', displayName: '   ' },
      { _id: 'extbot:1', displayName: 7 },
    ]);
    const out = await resolveDisplayNames(c.connection, [OID, 'ai-bot-x', 'extbot:1']);
    expect([...out.entries()]).toEqual([[OID, 'Alice']]);
    expect(c.collection).toHaveBeenCalledWith('users');
    expect(c.find.mock.calls[0][1]).toEqual({ projection: { displayName: 1 } });
  });

  it('skips the query for no usable ids', async () => {
    const c = conn([]);
    await expect(resolveDisplayNames(c.connection, ['', ' '])).resolves.toEqual(new Map());
    expect(c.find).not.toHaveBeenCalled();
  });

  it('returns an empty map on a lookup error (fail-soft, never the raw id)', async () => {
    const c = conn(new Error('mongo down'));
    await expect(resolveDisplayNames(c.connection, [OID])).resolves.toEqual(new Map());
  });
});
