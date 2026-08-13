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
 * Idempotent: rows already present in `user_blocks` are skipped, so it is safe to re-run.
 *
 * RUN IT AFTER THE SCHEMA FIX IS DEPLOYED — not before.
 * Until every old auth-service instance is gone, old instances keep writing to `userblocks`.
 * Anything they write after this script reads the source is simply left behind, invisible to
 * chat-service. Running post-rollout means new writes already land in `user_blocks` and this only
 * has to sweep up the historical rows. On a rolling deploy with mixed versions, run it once the
 * rollout completes, and re-run if in any doubt — a second pass costs nothing.
 *
 * DO NOT drop `userblocks` in the same maintenance window. Keep it until the rollout is confirmed
 * complete and a final pass reports `moved=0`: it is the only copy of anything a straggler wrote,
 * and it is also the rollback path if the deploy is reverted.
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

  // Indexes FIRST, before a single row is written. An upsert is not atomic against a concurrent
  // upsert with the same filter unless a unique index forces one of them to lose — so with a live
  // auth-service writing during the migration, two racing upserts could both insert
  // (blockerId, blockedId). Creating the index afterwards would then fail on those duplicates,
  // leaving a half-copied collection with no constraint. Creating it first makes the race a
  // harmless E11000 instead, and fails loudly here if `user_blocks` already holds duplicates —
  // which is a state to resolve before copying anything on top of it.
  db.getCollection(TARGET).createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
  db.getCollection(TARGET).createIndex({ blockedId: 1 });

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

  print(`[done] moved=${moved} already-present=${duplicate} total-now=${db.getCollection(TARGET).countDocuments()}`);
  if (moved > 0) {
    print(
      `[next] rows were still arriving in '${SOURCE}' — re-run once the rollout is complete and`,
    );
    print(`       this reports moved=0. Keep '${SOURCE}' until then.`);
  } else {
    print(
      `[next] nothing left to move. Once the rollout is confirmed complete and you have a backup,`,
    );
    print(`       '${SOURCE}' can be dropped manually:  db.${SOURCE}.drop()`);
  }
}
