// Seed fake dev chat data: call-log pills (new coded + legacy rows), a personal
// assistant (`extbot:*`) DM, an archived DM and a group.
//
// Run via ./scripts/dev/up.sh --seed, or directly:
//   docker exec -i chat-mongo mongosh platform --quiet < scripts/dev/seed-chat.js
//
// Users come from seed-users.js — run that first.

const DEV = db.users.findOne({ email: 'dev@pon.local' });
const ALICE = db.users.findOne({ email: 'alice@pon.local' });
if (!DEV || !ALICE) {
  throw new Error('run scripts/dev/seed-users.js first — dev@pon.local / alice@pon.local missing');
}

// chat-service maps `participants` / `senderId` as List<String> / String, so the
// ids must be stored as strings — seeding raw ObjectIds makes every query in the
// app miss and the conversations simply never show up.
const DEV_ID = String(DEV._id);
const ALICE_ID = String(ALICE._id);

const now = Date.now();
const at = (minsAgo) => new Date(now - minsAgo * 60000);

// ---------------------------------------------------------------- clean slate
const oldConvs = db.conversations
  .find({ participants: { $in: [DEV_ID, DEV._id] } }, { _id: 1 })
  .toArray()
  .map((c) => c._id);
if (oldConvs.length) {
  db.messages.deleteMany({ conversationId: { $in: oldConvs.map(String) } });
  db.conversations.deleteMany({ _id: { $in: oldConvs } });
}
// `$in` with both forms so a doc left over from an older seed that stored the
// owner as an ObjectId is cleaned up too — `botUserId` is uniquely indexed, so a
// survivor would collide with the insert below.
db.external_bots.deleteMany({ ownerUserId: { $in: [DEV_ID, DEV._id] } });

// ------------------------------------------- 1) DM with call history (Alice)
const dmId = db.conversations.insertOne({
  participants: [DEV_ID, ALICE_ID],
  type: 'direct',
  admins: [],
  createdBy: DEV_ID,
  publicChannel: false,
  pinnedMessages: [],
  status: 'accepted',
  hiddenFor: [],
  mutedUsers: [],
  archivedBy: [],
  lastMessage: { content: 'system.call.missed:video', senderId: ALICE_ID, createdAt: at(2) },
  lastMessageAt: at(2),
  createdAt: at(600),
  updatedAt: at(2),
}).insertedId;

db.messages.insertMany([
  {
    conversationId: String(dmId), senderId: ALICE_ID, type: 'text',
    content: 'Ê, gọi cho tao phát coi cái pill call log mới ra sao', readBy: [DEV_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(60),
  },
  // New coded system messages → the tinted pill (accent tint).
  {
    conversationId: String(dmId), senderId: 'system', type: 'system',
    content: 'system.call.ended:voice:125', readBy: [DEV_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(50),
  },
  {
    conversationId: String(dmId), senderId: 'system', type: 'system',
    content: 'system.call.ended:video:3725', readBy: [DEV_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(40),
  },
  // Missed → error tint.
  {
    conversationId: String(dmId), senderId: 'system', type: 'system',
    content: 'system.call.missed:voice', readBy: [],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(30),
  },
  {
    conversationId: String(dmId), senderId: 'system', type: 'system',
    content: 'system.call.missed:video', readBy: [],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(2),
  },
  // Legacy English rows (exact strings the old /call.end wrote, removed in
  // 19f000f) → must now render with a call icon instead of bare text.
  {
    conversationId: String(dmId), senderId: DEV_ID, type: 'call_log',
    content: 'Call ended - 02:05', readBy: [DEV_ID, ALICE_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(20),
  },
  {
    conversationId: String(dmId), senderId: ALICE_ID, type: 'call_log',
    content: 'Missed call', readBy: [DEV_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(15),
  },
]);

// ------------------------------- 2) Personal assistant DM (extbot:* peer)
const FACTORY_BOT_ID = 'bf-dev-0001';
const BOT_USER_ID = `extbot:${FACTORY_BOT_ID}`;
db.external_bots.insertOne({
  botUserId: BOT_USER_ID,
  factoryBotId: FACTORY_BOT_ID,
  ownerUserId: DEV_ID,
  name: 'Trợ lý của Phong',
  avatarUrl: null,
  enabled: true,
  createdAt: at(900),
});

const botConvId = db.conversations.insertOne({
  participants: [DEV_ID, BOT_USER_ID],
  type: 'direct',
  admins: [],
  createdBy: DEV_ID,
  publicChannel: false,
  pinnedMessages: [],
  status: 'accepted',
  hiddenFor: [],
  mutedUsers: [],
  archivedBy: [],
  lastMessage: {
    content: 'Đã ghi chú lại. Cần gì nữa không?',
    senderId: BOT_USER_ID,
    createdAt: at(5),
  },
  lastMessageAt: at(5),
  createdAt: at(900),
  updatedAt: at(5),
}).insertedId;

db.messages.insertMany([
  {
    conversationId: String(botConvId), senderId: DEV_ID, type: 'text',
    content: 'Nhắc tao 3h chiều mai họp sprint', readBy: [DEV_ID],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(6),
  },
  {
    conversationId: String(botConvId), senderId: BOT_USER_ID, type: 'text',
    content: 'Đã ghi chú lại. Cần gì nữa không?', readBy: [],
    reactions: [], deletedFor: [], mentions: [], createdAt: at(5),
  },
]);

// ------------------------------- 3) Archived DM (archived-chats tile fix)
const archivedId = db.conversations.insertOne({
  participants: [DEV_ID, BOT_USER_ID],
  type: 'direct',
  admins: [],
  createdBy: DEV_ID,
  publicChannel: false,
  pinnedMessages: [],
  status: 'accepted',
  hiddenFor: [],
  mutedUsers: [],
  archivedBy: [DEV_ID],
  lastMessage: { content: 'Bản nháp cũ', senderId: BOT_USER_ID, createdAt: at(4000) },
  lastMessageAt: at(4000),
  createdAt: at(5000),
  updatedAt: at(4000),
}).insertedId;
db.messages.insertOne({
  conversationId: String(archivedId), senderId: BOT_USER_ID, type: 'text',
  content: 'Bản nháp cũ', readBy: [DEV_ID],
  reactions: [], deletedFor: [], mentions: [], createdAt: at(4000),
});

// ------------------------------- 4) Group, so navigation has somewhere to go
const groupId = db.conversations.insertOne({
  participants: [DEV_ID, ALICE_ID],
  type: 'group',
  name: 'PON Dev Test',
  admins: [DEV_ID],
  createdBy: DEV_ID,
  publicChannel: false,
  pinnedMessages: [],
  status: 'accepted',
  hiddenFor: [],
  mutedUsers: [],
  archivedBy: [],
  lastMessage: { content: 'Nhóm test điều hướng', senderId: DEV_ID, createdAt: at(120) },
  lastMessageAt: at(120),
  createdAt: at(1000),
  updatedAt: at(120),
}).insertedId;
db.messages.insertOne({
  conversationId: String(groupId), senderId: DEV_ID, type: 'text',
  content: 'Nhóm test điều hướng', readBy: [DEV_ID],
  reactions: [], deletedFor: [], mentions: [], createdAt: at(120),
});

print('seeded:');
print('  dev user      : ' + DEV_ID + '  (dev@pon.local)');
print('  call-log DM   : ' + dmId);
print('  assistant DM  : ' + botConvId + '  peer=' + BOT_USER_ID);
print('  archived DM   : ' + archivedId);
print('  group         : ' + groupId);
print('  messages      : ' + db.messages.countDocuments({}));
