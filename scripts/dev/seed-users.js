// Create the dev accounts straight in Mongo.
//
// We deliberately do NOT go through POST /auth/register: auth-service requires
// the email domain to have a real MX record AND sends a real OTP email through
// the Gmail SMTP creds in .env — registering fake addresses would mail
// strangers. Password hashing here matches auth.service.ts (bcrypt, 10 rounds),
// so these accounts log in through the normal /auth/login path.
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const bcrypt = require(path.join(ROOT, 'node_modules/bcrypt'));
const { MongoClient } = require(path.join(ROOT, 'node_modules/mongodb'));

const PASSWORD = 'Devpass123!';
// `role` is the preset role name assigned to each dev account so the JWT carries
// the right `perms` claim (auth-service ClaimsService resolves roleId -> perms).
// Without it users get `perms: []` and every RBAC-gated endpoint (connectors,
// custom MCP, sensitive skills) 403s. dev = Owner (can demo everything incl.
// admin-only custom MCP); alice/bob = Member (can connect personal connectors
// but not add custom MCP nor run sensitive skills — shows the governance split).
const USERS = [
  { email: 'dev@pon.local', displayName: 'Phong Dev', role: 'Owner' },
  { email: 'alice@pon.local', displayName: 'Alice Test', role: 'Member' },
  { email: 'bob@pon.local', displayName: 'Bob Test', role: 'Member' },
];

(async () => {
  const hash = await bcrypt.hash(PASSWORD, await bcrypt.genSalt(10));
  // directConnection: the local Mongo is a single-member replica set that
  // advertises itself as `mongo:27017` (its in-compose hostname), which does
  // not resolve from the host — without this the driver chases that name.
  const client = await MongoClient.connect(
    'mongodb://localhost:27018/platform?directConnection=true',
  );
  const db = client.db('platform');
  const users = db.collection('users');
  const roles = db.collection('roles');

  // Preset roles are seeded by auth-service's BootstrapService on boot; up.sh
  // waits for the services to be healthy before running this seed, so they exist
  // by now. Map name -> _id once and reuse.
  const roleIdByName = {};
  for (const r of await roles.find({}, { projection: { name: 1 } }).toArray()) {
    roleIdByName[r.name] = r._id;
  }

  for (const u of USERS) {
    const roleId = roleIdByName[u.role];
    if (!roleId) {
      console.warn(
        `!! role "${u.role}" not found — ${u.email} will have no perms. ` +
          `Is auth-service up (it seeds preset roles on boot)?`,
      );
    }
    await users.updateOne(
      { email: u.email },
      {
        $set: {
          displayName: u.displayName,
          password: hash,
          isVerified: true,
          status: 'active',
          phoneVerified: false,
          trustedDevices: [],
          fcmTokens: [],
          socialLinks: {},
          updatedAt: new Date(),
          ...(roleId ? { roleId } : {}),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    const doc = await users.findOne({ email: u.email }, { projection: { _id: 1 } });
    console.log(`${doc._id}  ${u.email}  (${u.displayName})  role=${u.role}`);
  }

  console.log(`\npassword for all three: ${PASSWORD}`);
  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
