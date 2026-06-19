/*
 * One-time migration: users.blockedUsers[] -> user_blocks collection.
 *
 * Moves the legacy embedded block array onto its own collection (one row per
 * blocker->blocked pair), matching the new UserBlock schema. Idempotent: safe to
 * re-run — existing rows are skipped via the unique {blockerId, blockedId} index,
 * and the source array is only $unset after its rows are inserted.
 *
 * Run (port 27018 per project infra):
 *   mongosh "mongodb://localhost:27018/platform" apps/server/auth-service/scripts/migrate-blocked-users.mongo.js
 *
 * Run BEFORE deploying the user_blocks change, or right after — block checks fall
 * back to "not blocked" for un-migrated data until this runs.
 */
(function () {
  const users = db.getCollection('users');
  const blocks = db.getCollection('user_blocks');

  // Ensure the indexes the app expects exist (no-op if Mongoose already created them).
  blocks.createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
  blocks.createIndex({ blockedId: 1 });

  const cursor = users.find(
    { blockedUsers: { $exists: true, $ne: [] } },
    { _id: 1, blockedUsers: 1 },
  );

  let scanned = 0;
  let inserted = 0;
  let cleared = 0;

  cursor.forEach(function (u) {
    scanned += 1;
    const blockerId = String(u._id);
    const list = Array.isArray(u.blockedUsers) ? u.blockedUsers : [];

    list.forEach(function (blockedId) {
      const target = String(blockedId);
      if (!target || target === blockerId) return;
      try {
        blocks.updateOne(
          { blockerId: blockerId, blockedId: target },
          { $setOnInsert: { blockerId: blockerId, blockedId: target, createdAt: new Date() } },
          { upsert: true },
        );
        inserted += 1;
      } catch (e) {
        // Duplicate key on re-run is expected and fine.
        if (!String(e).includes('E11000')) throw e;
      }
    });

    users.updateOne({ _id: u._id }, { $unset: { blockedUsers: '' } });
    cleared += 1;
  });

  print(
    'migrate-blocked-users: scanned=' +
      scanned +
      ' upserts=' +
      inserted +
      ' users_cleared=' +
      cleared,
  );
})();
