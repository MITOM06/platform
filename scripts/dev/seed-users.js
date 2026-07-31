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
const USERS = [
  { email: 'dev@pon.local', displayName: 'Phong Dev' },
  { email: 'alice@pon.local', displayName: 'Alice Test' },
  { email: 'bob@pon.local', displayName: 'Bob Test' },
];

(async () => {
  const hash = await bcrypt.hash(PASSWORD, await bcrypt.genSalt(10));
  // directConnection: the local Mongo is a single-member replica set that
  // advertises itself as `mongo:27017` (its in-compose hostname), which does
  // not resolve from the host — without this the driver chases that name.
  const client = await MongoClient.connect(
    'mongodb://localhost:27018/platform?directConnection=true',
  );
  const users = client.db('platform').collection('users');

  for (const u of USERS) {
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
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    const doc = await users.findOne({ email: u.email }, { projection: { _id: 1 } });
    console.log(`${doc._id}  ${u.email}  (${u.displayName})`);
  }

  console.log(`\npassword for all three: ${PASSWORD}`);
  await client.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
