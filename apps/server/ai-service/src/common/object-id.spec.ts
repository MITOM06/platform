import { Types } from 'mongoose';
import { toObjectId, toObjectIds } from './object-id';

describe('toObjectId', () => {
  it('converts a 24-hex string', () => {
    const hex = new Types.ObjectId().toHexString();
    expect(toObjectId(hex)?.toHexString()).toBe(hex);
  });

  it.each(['system', 'ai-bot-000000000000000000000001', 'extbot:bf-1', 'abcdefghijkl', '', null, 42])(
    'returns null for %p',
    (id) => expect(toObjectId(id)).toBeNull(),
  );
});

describe('toObjectIds', () => {
  it('keeps only valid ids', () => {
    const hex = new Types.ObjectId().toHexString();
    expect(toObjectIds([hex, 'system', 'ai-bot-000000000000000000000001']).map((o) => o.toHexString())).toEqual([hex]);
  });
});
