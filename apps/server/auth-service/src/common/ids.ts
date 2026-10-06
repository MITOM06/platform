const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/;

/**
 * Strict "is this a Mongo ObjectId string" check (24 hex chars).
 *
 * Route params and stored actor ids are not always ObjectIds — the boot-time Owner invitation
 * is audited with actorId `'system'`, bot ids look like `ai-bot-…` — and handing one of those
 * to `findById` / `{ _id: { $in } }` throws a CastError, i.e. an untyped 500. Mongoose's own
 * `isValidObjectId` is not enough: it also accepts any 12-character string.
 */
export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_HEX.test(value);
}

/** Order- and duplicate-insensitive equality of two id lists (ObjectIds compared as strings). */
export function sameIdSet(
  a: readonly unknown[] | null | undefined,
  b: readonly unknown[] | null | undefined,
): boolean {
  const left = new Set((a ?? []).map(String));
  const right = new Set((b ?? []).map(String));
  if (left.size !== right.size) return false;
  for (const id of left) if (!right.has(id)) return false;
  return true;
}
