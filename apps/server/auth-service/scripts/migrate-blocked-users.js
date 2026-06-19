/*
 * One-time migration: users.blockedUsers[] -> user_blocks collection (Node runner).
 *
 * Same logic as migrate-blocked-users.mongo.js, but runs with plain Node + the
 * mongoose dependency already in auth-service — no mongosh install needed.
 * Idempotent: re-runnable, existing rows are skipped via the unique index.
 *
 * Run (infra must be up so MongoDB is reachable on the .env MONGO_URI):
 *   cd apps/server/auth-service && node scripts/migrate-blocked-users.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function loadMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  // Minimal .env reader so the script is self-contained.
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*MONGO_URI\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return 'mongodb://localhost:27018/platform?directConnection=true';
}

async function main() {
  const uri = loadMongoUri();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const blocks = db.collection('user_blocks');

  await blocks.createIndex({ blockerId: 1, blockedId: 1 }, { unique: true });
  await blocks.createIndex({ blockedId: 1 });

  const cursor = users.find(
    { blockedUsers: { $exists: true, $ne: [] } },
    { projection: { _id: 1, blockedUsers: 1 } },
  );

  let scanned = 0;
  let upserts = 0;
  let cleared = 0;

  for await (const u of cursor) {
    scanned += 1;
    const blockerId = String(u._id);
    const list = Array.isArray(u.blockedUsers) ? u.blockedUsers : [];

    for (const blockedRaw of list) {
      const blockedId = String(blockedRaw);
      if (!blockedId || blockedId === blockerId) continue;
      try {
        await blocks.updateOne(
          { blockerId, blockedId },
          { $setOnInsert: { blockerId, blockedId, createdAt: new Date() } },
          { upsert: true },
        );
        upserts += 1;
      } catch (e) {
        if (!String(e).includes('E11000')) throw e; // dup on re-run is fine
      }
    }

    await users.updateOne({ _id: u._id }, { $unset: { blockedUsers: '' } });
    cleared += 1;
  }

  console.log(
    `migrate-blocked-users: scanned=${scanned} upserts=${upserts} users_cleared=${cleared}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
