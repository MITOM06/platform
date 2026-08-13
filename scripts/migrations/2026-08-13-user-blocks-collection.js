/**
 * Migration — move block rows from `userblocks` into `user_blocks`.
 *
 * Why: `UserBlockSchema` was declared without an explicit `collection`, so Mongoose pluralized the
 * class name and auth-service wrote every block into `userblocks`. chat-service reads
 * `user_blocks` (`@Document(collection = "user_blocks")`), so it never saw a single block and the
 * Block User feature silently did nothing — blocked users could still send messages and place
 * calls. The schema now pins `collection: 'user_blocks'`; this moves the rows users already
 * created so their existing block lists keep working.
 *
 * Idempotent: re-running is a no-op once `userblocks` is empty/absent. Rows already present in
 * `user_blocks` are skipped, so it is safe to run before or after deploying the schema fix.
 *
 * Usage:
 *   mongosh "$MONGODB_URI" scripts/migrations/2026-08-13-user-blocks-collection.js
 *   # local: mongosh "mongodb://localhost:27018/platform" scripts/migrations/...
 */
const SOURCE = 'userblocks';
const TARGET = 'user_blocks';

const names = db.getCollectionNames();
if (!names.includes(SOURCE)) {
  print(`[skip] '${SOURCE}' does not exist — nothing to migrate.`);
} else {
  const total = db.getCollection(SOURCE).countDocuments();
  print(`[info] ${total} document(s) in '${SOURCE}'`);

  let moved = 0;
  let duplicate = 0;

  db.getCollection(SOURCE)
    .find()
    .forEach((doc) => {
      const res = db.getCollection(TARGET).updateOne(
        { blockerId: doc.blockerId, blockedId: doc.blockedId },
        {
          $setOnInsert: {
            blockerId: doc.blockerId,
            blockedId: doc.blockedId,
            createdAt: doc.createdAt || new Date(),
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount > 0) moved += 1;
      else duplicate += 1;
    });

  // Match the indexes the Mongoose schema declares, so the unique constraint survives the move.
  db.getCollection(TARGET).createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
  db.getCollection(TARGET).createIndex({ blockedId: 1 });

  print(`[done] moved=${moved} already-present=${duplicate} total-now=${db.getCollection(TARGET).countDocuments()}`);
  print(
    `[next] verify '${TARGET}', then drop the old collection manually:  db.${SOURCE}.drop()`,
  );
}
