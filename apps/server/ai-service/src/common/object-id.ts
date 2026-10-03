import { Types } from 'mongoose';

/**
 * Ids travel through the system as strings (JWT `sub`, message `senderId`), but
 * the `users` collection keys on a real ObjectId — querying `_id` with the string
 * silently matches nothing. Non-user sender ids (`system`, `ai-bot-…`,
 * `extbot:…`) are not ObjectIds and are dropped rather than throwing.
 */
export function toObjectId(id: unknown): Types.ObjectId | null {
  // isValid alone also accepts any 12-char string, so require the 24-hex form.
  return typeof id === 'string' && id.length === 24 && Types.ObjectId.isValid(id)
    ? new Types.ObjectId(id)
    : null;
}

export function toObjectIds(ids: unknown[]): Types.ObjectId[] {
  return ids.map(toObjectId).filter((o): o is Types.ObjectId => o !== null);
}
