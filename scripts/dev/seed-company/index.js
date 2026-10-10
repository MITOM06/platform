// Seed the fake company "NovaTech Solutions" for full-flow local testing:
// departments, ~22 employees with roles, invitations, role-aware AI context,
// department/project/social groups, DMs, an AI chat, real files in GridFS,
// knowledge-base documents (embedded for real by ai-service), reminders, AI
// memory, token usage, feedback, notifications and audit log.
//
//   node scripts/dev/seed-company/index.js          # (re)seed — idempotent
//   node scripts/dev/seed-company/index.js --reset  # remove the company only
//
// Needs seed-users.js to have run first (dev/alice/bob join the company).
// Every document written here carries `seedTag: 'novatech'` (GridFS:
// `metadata.seedTag`), so a re-run wipes exactly this data and nothing else.
// DEV-ONLY: never commit this to main (.claude/rules/dev-local-only.md).

const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const bcrypt = require(path.join(ROOT, 'node_modules/bcrypt'));
const { MongoClient, ObjectId, GridFSBucket } = require(path.join(ROOT, 'node_modules/mongodb'));
const Redis = require(path.join(ROOT, 'node_modules/ioredis'));

const org = require('./org');
const { CONVERSATIONS, FRIENDSHIPS, REMINDERS, MEMORIES } = require('./conversations');
const { buildFiles, avatarPng } = require('./files');
const { buildMessages } = require('./messages');

const TAG = 'novatech';
const PASSWORD = 'Devpass123!';
const AI_BOT_ID = 'ai-bot-000000000000000000000001';
const MUTE_FOREVER_MS = 9_200_000_000_000_000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018/platform?directConnection=true';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RESET_ONLY = process.argv.includes('--reset');

const now = Date.now();
const minsAgo = (m) => new Date(now - m * 60000);
const tagged = (doc) => ({ ...doc, seedTag: TAG });

// ------------------------------------------------------------------ helpers

function connectRedis() {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
  return redis.connect().then(() => redis, () => null);
}

async function storeFile(bucket, { name, mime, buf }, uploadedBy) {
  const fileId = crypto.randomUUID();
  await new Promise((resolve, reject) => {
    bucket
      .openUploadStream(fileId, {
        // Same metadata shape chat-service's UploadController writes.
        metadata: { _contentType: mime, fileId, originalFilename: name, uploadedBy, seedTag: TAG },
      })
      .on('finish', resolve)
      .on('error', reject)
      .end(buf);
  });
  return `/api/uploads/${fileId}`;
}

// ------------------------------------------------------------------- reset

// Collections that hold seeded documents (users/messages/GridFS handled apart).
const TRACKED = [
  'conversations', 'departments', 'friendships', 'invitations', 'ai_context_entries',
  'ai_user_context', 'reminders', 'ai_memories', 'token_usage', 'auditlogs', 'notifications',
  'ai_personas', 'ai_feedback', 'kb_documents',
];
const MANIFEST = 'dev_seed_manifest';

/**
 * Snapshot every seeded _id right after seeding. `seedTag` alone is not
 * enough: Spring's save() and ai-service rewrite whole documents (a new message
 * bumps the conversation, a reminder gets marked done, a KB doc finishes
 * processing) and silently drop fields their models don't know.
 */
async function writeManifest(db) {
  const collections = {};
  for (const c of TRACKED) {
    collections[c] = (await db.collection(c).find({ seedTag: TAG }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  }
  await db.collection(MANIFEST).replaceOne({ _id: TAG }, { _id: TAG, collections, createdAt: new Date() }, { upsert: true });
}

async function reset(db, bucket, redis) {
  const manifest = (await db.collection(MANIFEST).findOne({ _id: TAG })) || { collections: {} };
  const filterFor = (c) => ({ $or: [{ seedTag: TAG }, { _id: { $in: manifest.collections[c] || [] } }] });

  const users = await db.collection('users').find({ email: { $regex: `@${org.DOMAIN.replace('.', '\\.')}$` } }, { projection: { _id: 1 } }).toArray();
  const fakeUserIds = users.map((u) => String(u._id));

  // Seeded conversations, plus any a tester created later with a fake employee.
  const convIds = (await db.collection('conversations')
    .find({ $or: [filterFor('conversations'), { participants: { $in: fakeUserIds } }] }, { projection: { _id: 1 } })
    .toArray()).map((c) => String(c._id));
  await db.collection('messages').deleteMany({ conversationId: { $in: convIds } });
  await db.collection('conversations').deleteMany({ _id: { $in: convIds.map((id) => new ObjectId(id)) } });

  // KB: also drop the vectors in Qdrant, via the same channel chat-service uses.
  const kbFilter = { $or: [filterFor('kb_documents'), { conversationId: { $in: convIds } }] };
  const kbDocs = await db.collection('kb_documents').find(kbFilter, { projection: { documentId: 1 } }).toArray();
  await db.collection('kb_documents').deleteMany(kbFilter);
  if (redis) for (const d of kbDocs) await redis.publish('kb:delete', JSON.stringify({ documentId: d.documentId }));

  for (const f of await db.collection('fs.files').find({ 'metadata.seedTag': TAG }, { projection: { _id: 1 } }).toArray()) {
    await bucket.delete(f._id);
  }

  // Detach the surviving dev accounts from departments that are about to go.
  const deptIds = (await db.collection('departments').find(filterFor('departments'), { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  if (deptIds.length) await db.collection('users').updateMany({}, { $pull: { departmentIds: { $in: deptIds } } });

  await db.collection('users').deleteMany({ _id: { $in: users.map((u) => u._id) } });
  for (const c of TRACKED) if (c !== 'kb_documents' && c !== 'conversations') await db.collection(c).deleteMany(filterFor(c));
  await db.collection(MANIFEST).deleteOne({ _id: TAG });
  console.log(`reset: removed ${convIds.length} conversations, ${users.length} users, ${kbDocs.length} KB docs`);
}

// -------------------------------------------------------------------- seed

async function seedPeople(db, bucket) {
  const roles = {};
  for (const r of await db.collection('roles').find({}).toArray()) roles[r.name] = r._id;
  if (!roles.Member) throw new Error('preset roles missing — start auth-service once (it seeds them on boot)');

  // Departments first (leads resolved after users exist).
  const dept = {};
  for (const d of org.DEPARTMENTS) {
    const { insertedId } = await db.collection('departments').insertOne(tagged({
      name: d.name, description: d.description, createdAt: minsAgo(60 * 24 * 60), updatedAt: new Date(),
    }));
    dept[d.key] = insertedId;
  }

  const ids = {}; // person key → ObjectId
  const names = {};
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const [i, p] of org.PEOPLE.entries()) {
    const avatarUrl = await storeFile(bucket, { name: `avatar-${p.key}.png`, mime: 'image/png', buf: await avatarPng(p.name, i) }, 'seed');
    const { insertedId } = await db.collection('users').insertOne({
      displayName: p.name, email: p.email, password: hash, isVerified: true, status: p.status || 'active',
      avatarUrl, bio: `${p.title} @ NovaTech Solutions`, gender: p.gender,
      ...(p.phone ? { phoneNumber: p.phone, phoneVerified: true } : { phoneVerified: false }),
      roleId: roles[p.role], departmentIds: p.depts.map((k) => dept[k]),
      trustedDevices: [], fcmTokens: [], socialLinks: {}, hideInfo: false,
      showDateOfBirth: true, showPhoneNumber: true, showGender: true,
      createdAt: minsAgo(60 * 24 * (40 + i)), updatedAt: new Date(),
    });
    ids[p.key] = insertedId;
    names[p.key] = p.name;
  }
  for (const e of org.EXISTING) {
    const u = await db.collection('users').findOne({ email: e.email });
    if (!u) throw new Error(`${e.email} missing — run scripts/dev/seed-users.js first`);
    await db.collection('users').updateOne({ _id: u._id }, { $addToSet: { departmentIds: { $each: e.depts.map((k) => dept[k]) } } });
    ids[e.key] = u._id;
    names[e.key] = u.displayName;
  }
  for (const d of org.DEPARTMENTS) {
    await db.collection('departments').updateOne({ _id: dept[d.key] }, { $set: { leadUserId: ids[d.lead] } });
  }

  // Invitations (token hashes are random — these links can't be accepted; use
  // the admin "resend" action to get a working one).
  for (const inv of org.INVITATIONS) {
    const created = minsAgo(inv.daysAgo * 24 * 60);
    await db.collection('invitations').insertOne(tagged({
      email: inv.email, roleId: roles[inv.role], departmentIds: inv.depts.map((k) => dept[k]),
      invitedBy: String(ids[inv.invitedBy]), tokenHash: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(created.getTime() + 7 * 24 * 3600 * 1000), status: inv.status,
      ...(inv.status === 'revoked' ? { revokedAt: minsAgo(inv.daysAgo * 24 * 60 - 120) } : {}),
      lastSentAt: created, sendCount: 1, locale: 'vi', createdAt: created, updatedAt: created,
    }));
  }

  const owner = String(ids.quan);
  for (const c of org.AI_CONTEXT) {
    await db.collection('ai_context_entries').insertOne(tagged({
      scope: c.scope, scopeId: c.scope === 'department' ? String(dept[c.dept]) : null,
      label: c.label, text: c.text, requiredCapability: c.cap, createdBy: owner, updatedBy: owner,
      createdAt: minsAgo(20 * 24 * 60), updatedAt: minsAgo(20 * 24 * 60),
    }));
  }
  const titles = Object.fromEntries([...org.PEOPLE, ...org.EXISTING].map((p) => [p.key, p.title]));
  for (const [key, ctx] of Object.entries(org.USER_CONTEXT)) {
    const userId = String(ids[key]);
    await db.collection('ai_user_context').deleteOne({ userId });
    await db.collection('ai_user_context').insertOne(tagged({
      userId, jobTitle: titles[key], ...ctx, updatedBy: userId, createdAt: new Date(), updatedAt: new Date(),
    }));
  }
  return { ids, names, dept, roles };
}

async function seedSocial(db, { ids, names }) {
  for (const [a, b, status = 'accepted'] of FRIENDSHIPS) {
    const createdAt = minsAgo(status === 'pending' ? 6 * 60 : 30 * 24 * 60);
    await db.collection('friendships').insertOne(tagged({
      requesterId: String(ids[a]), recipientId: String(ids[b]), status, createdAt, updatedAt: createdAt,
    }));
    if (status === 'pending') {
      // Clients localize by `type`; title/body are the stored English fallback.
      await db.collection('notifications').insertOne(tagged({
        recipientId: String(ids[b]), type: 'FRIEND_REQUEST', title: 'New friend request',
        body: `${names[a]} sent you a friend request`, actorId: String(ids[a]), actorName: names[a],
        readAt: null, createdAt, updatedAt: createdAt,
      }));
    }
  }
}

async function seedConversations(db, bucket, redis, ctx) {
  const { ids, dept } = ctx;
  const uid = (k) => (k === 'ai' ? AI_BOT_ID : k === 'system' ? 'system' : String(ids[k]));
  const files = await buildFiles();
  const fileUrls = {};
  const urlFor = async (key, uploader) => (fileUrls[key] ??= await storeFile(bucket, files[key], uploader));
  const allPeople = [...org.PEOPLE.filter((p) => p.status !== 'blocked'), ...org.EXISTING].map((p) => p.key);

  const convIds = {};
  const aiMessages = [];
  let kbCount = 0;
  for (const c of CONVERSATIONS) {
    const members = c.members === 'ALL' ? allPeople : c.members;
    const participants = members.map(uid);
    const convId = new ObjectId();
    convIds[c.key] = convId;

    const { docs, pinned, kbFiles } = await buildMessages({ c, convId: String(convId), participants, uid, files, urlFor, minsAgo });
    const last = docs[docs.length - 1];
    await db.collection('conversations').insertOne(tagged({
      _id: convId, participants, type: c.type, ...(c.name ? { name: c.name } : {}),
      admins: (c.admins || []).map(uid), createdBy: uid(c.createdBy || members[0]),
      ...(c.dept ? { departmentId: String(dept[c.dept]) } : {}),
      publicChannel: !!c.publicChannel, pinnedMessages: pinned, status: c.status || 'accepted',
      ...(c.autoDeleteSeconds ? { autoDeleteSeconds: c.autoDeleteSeconds } : {}),
      hiddenFor: [], archivedBy: (c.archivedFor || []).map(uid), blockedBy: [], pendingMembers: [],
      mutedUntil: Object.fromEntries((c.mutedFor || []).map((k) => [uid(k), MUTE_FOREVER_MS])),
      lastMessage: { content: last.content, senderId: last.senderId, createdAt: last.createdAt },
      lastMessageAt: last.createdAt, createdAt: minsAgo(c.start), updatedAt: last.createdAt,
      _class: 'com.platform.chatservice.model.Conversation',
    }));
    await db.collection('messages').insertMany(docs);
    aiMessages.push(...docs.filter((d) => d.type === 'ai').map((d) => ({ ...d, members: participants })));

    if (c.persona) {
      await db.collection('ai_personas').insertOne(tagged({
        conversationId: String(convId), name: c.persona.name, tone: c.persona.tone,
        systemPromptPrefix: c.persona.prefix, createdBy: uid(c.createdBy), updatedAt: new Date(),
      }));
    }

    // Knowledge base: register + ask ai-service to embed, exactly like KbController.
    for (const kb of kbFiles) {
      const documentId = crypto.randomUUID();
      const payload = {
        documentId, conversationId: String(convId), userId: kb.userId, fileUrl: kb.url,
        mimeType: kb.mime, fileName: kb.name, departmentId: c.dept ? String(dept[c.dept]) : null,
      };
      await db.collection('kb_documents').insertOne(tagged({
        ...payload, status: 'pending', chunkCount: 0, uploadedAt: kb.createdAt,
        _class: 'com.platform.chatservice.model.KbDocument',
      }));
      if (redis) await redis.publish('kb:process', JSON.stringify(payload));
      kbCount++;
    }
  }
  return { convIds, aiMessages, kbCount };
}

async function seedAiData(db, { ids }, { convIds, aiMessages }) {
  for (const r of REMINDERS) {
    await db.collection('reminders').insertOne(tagged({
      userId: String(ids[r.user]), conversationId: String(convIds[r.conv]), text: r.text,
      remindAt: new Date(now + r.inMins * 60000), done: !!r.done, notified: !!r.done, attempts: 0,
      createdAt: minsAgo(3 * 24 * 60), _class: 'com.platform.chatservice.model.Reminder',
    }));
  }
  for (const m of MEMORIES) {
    await db.collection('ai_memories').insertOne(tagged({
      conversationId: String(convIds[m.conv]), userId: String(ids[m.user]), summary: m.summary,
      keyFacts: m.keyFacts, messageCount: m.messageCount, updatedAt: minsAgo(60),
    }));
  }

  // 30 days of token usage for the people who use the assistant most.
  const heavy = ['dev', 'quan', 'nam', 'phuc', 'tram', 'son', 'nhung', 'linh', 'vy', 'thao', 'long', 'viet'];
  for (const [i, key] of heavy.entries()) {
    for (let d = 0; d < 30; d++) {
      const day = new Date(now - d * 86400000);
      if ([0, 6].includes(day.getDay()) && d % 3) continue; // weekends mostly quiet
      const base = 4000 + ((i * 7919 + d * 104729) % 26000);
      await db.collection('token_usage').updateOne(
        { userId: String(ids[key]), date: day.toISOString().slice(0, 10) },
        // $setOnInsert: never clobber real usage recorded by ai-service.
        { $setOnInsert: tagged({ inputTokens: base * 6, outputTokens: base, requestCount: 3 + (base % 17), updatedAt: day }) },
        { upsert: true },
      );
    }
  }

  // Thumbs up/down from the asker of each AI answer.
  for (const [i, m] of aiMessages.entries()) {
    const voter = m.members.find((p) => p !== AI_BOT_ID);
    await db.collection('ai_feedback').insertOne(tagged({
      messageId: String(m._id), conversationId: m.conversationId, userId: voter,
      rating: i % 4 === 3 ? 'down' : 'up', comment: i % 4 === 3 ? 'Thiếu nguồn trích dẫn cụ thể' : null,
      createdAt: m.createdAt, updatedAt: m.createdAt,
    }));
  }
}

async function seedAudit(db, { ids, names }) {
  const A = (actor, action, targetType, meta, daysAgo) => ({ actor, action, targetType, meta, daysAgo });
  const entries = [
    A('quan', 'workspace.update', 'workspace', { field: 'name', value: org.WORKSPACE.name }, 30),
    A('ha', 'department.create', 'department', { name: 'Chăm sóc khách hàng' }, 29),
    A('nhung', 'member.invite', 'invitation', { email: `newhire.backend@${org.DOMAIN}` }, 1),
    A('nhung', 'member.update', 'user', { field: 'role', from: 'Admin', to: 'Member', user: names.viet }, 12),
    A('huy', 'connector.connect', 'connection', { provider: 'notion', scope: 'workspace' }, 15),
    A('huy', 'custom_mcp.add', 'custom_mcp', { name: 'SAP ERP (ABC Corp)' }, 4),
    A('ha', 'member.block', 'user', { user: names.teo, reason: 'Hết hợp đồng thực tập' }, 8),
    A('quan', 'role.update', 'role', { role: 'Member', capability: 'VIEW_INTERNAL_CONTEXT', value: false }, 18),
    A('quan', 'ai_context.update', 'ai_context', { label: 'Khung lương (mật)' }, 20),
    A('phuc', 'sensitive_skill.run', 'skill', { tool: 'gmail.send', to: 'contact@minhphat.vn' }, 3),
  ];
  await db.collection('auditlogs').insertMany(entries.map((e) => tagged({
    actorId: String(ids[e.actor]), actorName: names[e.actor], action: e.action, targetType: e.targetType,
    meta: e.meta, createdAt: minsAgo(e.daysAgo * 24 * 60),
  })));
}

// -------------------------------------------------------------------- main

(async () => {
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db('platform');
  const bucket = new GridFSBucket(db); // chat-service GridFsTemplate default bucket "fs"
  const redis = await connectRedis();
  if (!redis) console.warn(`!! Redis unreachable at ${REDIS_URL} — KB docs will stay "pending" (not embedded)`);

  await reset(db, bucket, redis);
  if (!RESET_ONLY) {
    await db.collection('workspaces').updateOne({}, { $set: { ...org.WORKSPACE, updatedAt: new Date() } });
    const ctx = await seedPeople(db, bucket);
    await seedSocial(db, ctx);
    const convs = await seedConversations(db, bucket, redis, ctx);
    await seedAiData(db, ctx, convs);
    await seedAudit(db, ctx);
    await writeManifest(db);

    console.log(`\nNovaTech Solutions seeded:`);
    console.log(`  ${org.DEPARTMENTS.length} departments, ${org.PEOPLE.length} new people (+ dev/alice/bob), ${org.INVITATIONS.length} invitations`);
    console.log(`  ${CONVERSATIONS.length} conversations, ${convs.aiMessages.length} AI answers, ${convs.kbCount} KB documents ${redis ? 'queued for embedding' : '(pending)'}`);
    console.log(`\n  login: any <name>@${org.DOMAIN} (or dev@pon.local) / ${PASSWORD}`);
    for (const p of org.PEOPLE) console.log(`    ${p.email.padEnd(32)} ${p.role.padEnd(8)} ${p.title}${p.status === 'blocked' ? '  [BLOCKED]' : ''}`);
    console.log('\n  Already logged in? Log out and back in — department/role claims live in the JWT.');
  }
  if (redis) redis.disconnect();
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

