import { Logger } from '@nestjs/common';
import { Connection, Types } from 'mongoose';

const logger = new Logger('UserNames');

/** Generic label for a person whose name cannot be resolved — never their raw id. */
export const UNKNOWN_MEMBER_LABEL = 'A member';

/**
 * `_id` values to query the shared `users` collection with. People (created by
 * auth-service) have ObjectId `_id`s; bots (`ai-bot-…`, `extbot:…`) have string
 * ones. Querying with the raw strings alone never matched a person, so callers
 * fell back to the raw id and it reached the model — and from there the chat.
 */
export function userIdQueryValues(ids: string[]): Array<string | Types.ObjectId> {
  const out: Array<string | Types.ObjectId> = [];
  for (const id of new Set(ids.filter((i) => typeof i === 'string' && i.trim() !== ''))) {
    out.push(id);
    if (/^[0-9a-f]{24}$/i.test(id)) out.push(new Types.ObjectId(id));
  }
  return out;
}

/**
 * userId → displayName for the given ids in ONE query. Ids that do not resolve
 * are simply absent (callers show `UNKNOWN_MEMBER_LABEL`). Fail-soft: a lookup
 * error yields an empty map rather than failing the caller.
 */
export async function resolveDisplayNames(
  connection: Connection,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const values = userIdQueryValues(ids);
  if (values.length === 0) return names;
  try {
    const docs = await connection
      .collection('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find({ _id: { $in: values } } as any, { projection: { displayName: 1 } })
      .toArray();
    for (const u of docs) {
      const name = typeof u['displayName'] === 'string' ? (u['displayName'] as string).trim() : '';
      if (name) names.set(String(u['_id']), name);
    }
  } catch (err) {
    logger.warn(`Display-name lookup failed for ${values.length} id(s): ${(err as Error).message}`);
  }
  return names;
}
