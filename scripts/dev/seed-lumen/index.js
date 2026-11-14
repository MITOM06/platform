// Seed the demo company "Lumen Software" (31 people incl. one offboarded, 2 project departments,
// six months of chat incl. background threads (filler.js), files, knowledge base,
// meetings, calls, AI memory, connectors/skills/blocks, audit log).
//
//   node scripts/dev/seed-lumen/index.js            # (re)seed — idempotent; people are KEPT
//                                                   # (2FA, passwords, connectors, sessions survive)
//   node scripts/dev/seed-lumen/index.js --reset    # remove the company incl. the 30 accounts
//
// Env: MONGO_URI (or MONGODB_URI), REDIS_URL, QDRANT_URL, VOYAGE_API_KEY, KB_EMBEDDING_MODEL.
// Runs from the repo (local stack) or inside the ai-service image (/app/seed-lumen).
// Every document carries `seedTag: 'lumen'` (GridFS: metadata.seedTag) and the
// manifest records every _id, so a re-run / --reset wipes exactly this data.
// DEV-ONLY: never commit this to main (docs/engineering/dev-local-only.md).

const crypto = require('node:crypto');
const { mod, STORY_NOW, REAL_NOW, ictTime } = require('./lib');
const bcrypt = mod('bcrypt');
const { MongoClient, ObjectId, GridFSBucket } = mod('mongodb');
const Redis = mod('ioredis');

const org = require('./org');
const { CONVERSATIONS, FRIENDSHIPS, REMINDERS, MEMORIES, MEMORY_FACTS } = require('./conversations');
const { CHAPTER: CHAPTER_NOV, REMINDERS_NOV: REMINDERS_NOV_ONLY } = require('./chapter-nov');
const { CHAPTER_W46, REMINDERS_W46 } = require('./chapter-w46');
const { CHAPTER_EXTRAS } = require('./chapter-extras');
const { seedMeetings } = require('./meeting-seed');
const { buildNovFiles } = require('./files-nov');
const { buildW46Files } = require('./files-w46');
const { withFiller } = require('./filler');
const { buildFiles, avatarPng } = require('./files');
const { buildMessages, AI_BOT_ID } = require('./messages');

// November chapter + week 46 (Fri 13/11 demo day) + calls/stickers/voice notes, merged per conversation.
const CHAPTERS = [CHAPTER_NOV, CHAPTER_W46, CHAPTER_EXTRAS];
const CHAPTER = Object.fromEntries([...new Set(CHAPTERS.flatMap(Object.keys))]
  .map((k) => [k, CHAPTERS.flatMap((ch) => ch[k] || [])]));
const REMINDERS_NOV = [...REMINDERS_NOV_ONLY, ...REMINDERS_W46];

const TAG = 'lumen';
const PASSWORD = process.env.SEED_PASSWORD || 'Lumen2026!';
const MUTE_FOREVER_MS = 9_200_000_000_000_000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/platform?directConnection=true';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QDRANT_URL = (process.env.QDRANT_URL || '').replace(/\/+$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || '';
const EMBED_MODEL = process.env.KB_EMBEDDING_MODEL || 'voyage-4-lite';
const MEMORY_COLLECTION = process.env.QDRANT_MEMORY_COLLECTION || 'ai_memory';
const RESET_ONLY = process.argv.includes('--reset');

// Story time (scripted chat, files, meetings) vs real time (invitations,
// upcoming meetings, open reminders, token meter) — see lib.js.
const now = STORY_NOW;
const minsAgo = (m) => new Date(now - m * 60000);
const realMinsAgo = (m) => new Date(REAL_NOW - m * 60000);
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
      .openUploadStream(fileId, { metadata: { _contentType: mime, fileId, originalFilename: name, uploadedBy, seedTag: TAG } })
      .on('finish', resolve)
      .on('error', reject)
      .end(buf);
  });
  return `/api/uploads/${fileId}`;
}

const qdrantHeaders = () => ({ 'content-type': 'application/json', ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}) });

async function embed(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, input_type: 'document' }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

// ------------------------------------------------------------------- reset

const TRACKED = [
  'conversations', 'departments', 'friendships', 'invitations', 'ai_context_entries', 'ai_user_context',
  'reminders', 'ai_memories', 'token_usage', 'auditlogs', 'notifications', 'ai_personas', 'ai_feedback',
  'kb_documents', 'meetings', 'meeting_notes', 'meeting_messages', 'meeting_summaries', 'meeting_records',
  'user_connections', 'user_skills', 'user_blocks', 'call_sessions', 'ai_digest_log',
];
const MANIFEST = 'dev_seed_manifest';

async function writeManifest(db, userIds) {
  const collections = {};
  for (const c of TRACKED) {
    collections[c] = (await db.collection(c).find({ seedTag: TAG }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  }
  await db.collection(MANIFEST).replaceOne({ _id: TAG }, { _id: TAG, collections, userIds, createdAt: new Date() }, { upsert: true });
}

async function reset(db, bucket, redis) {
  const manifest = (await db.collection(MANIFEST).findOne({ _id: TAG })) || { collections: {}, userIds: [] };
  const filterFor = (c) => ({ $or: [{ seedTag: TAG }, { _id: { $in: manifest.collections[c] || [] } }] });

  const domainRe = new RegExp(`@${org.DOMAIN.replace('.', '\\.')}$`);
  const users = await db.collection('users').find({ $or: [{ email: domainRe }, { _id: { $in: (manifest.userIds || []).map((id) => new ObjectId(id)) } }] }, { projection: { _id: 1 } }).toArray();
  const fakeUserIds = users.map((u) => String(u._id));

  const convIds = (await db.collection('conversations')
    .find({ $or: [filterFor('conversations'), { participants: { $in: fakeUserIds } }] }, { projection: { _id: 1 } })
    .toArray()).map((c) => String(c._id));
  await db.collection('messages').deleteMany({ conversationId: { $in: convIds } });
  await db.collection('conversations').deleteMany({ _id: { $in: convIds.map((id) => new ObjectId(id)) } });

  const kbFilter = { $or: [filterFor('kb_documents'), { conversationId: { $in: convIds } }] };
  const kbDocs = await db.collection('kb_documents').find(kbFilter, { projection: { documentId: 1 } }).toArray();
  await db.collection('kb_documents').deleteMany(kbFilter);
  if (redis) for (const d of kbDocs) await redis.publish('kb:delete', JSON.stringify({ documentId: d.documentId }));

  for (const f of await db.collection('fs.files').find({ 'metadata.seedTag': TAG }, { projection: { _id: 1 } }).toArray()) {
    await bucket.delete(f._id);
  }

  // Meetings hosted by / attended by fake people (also any created later with them).
  const meetingIds = (await db.collection('meetings')
    .find({ $or: [filterFor('meetings'), { hostId: { $in: fakeUserIds } }] }, { projection: { _id: 1 } }).toArray()).map((m) => String(m._id));
  await db.collection('meeting_notes').deleteMany({ $or: [filterFor('meeting_notes'), { meetingId: { $in: meetingIds } }] });
  await db.collection('meeting_messages').deleteMany({ $or: [filterFor('meeting_messages'), { meetingId: { $in: meetingIds } }] });
  await db.collection('meeting_summaries').deleteMany({ $or: [filterFor('meeting_summaries'), { meetingId: { $in: meetingIds } }] });
  await db.collection('meeting_records').deleteMany({ $or: [filterFor('meeting_records'), { meetingId: { $in: meetingIds } }] });
  await db.collection('meetings').deleteMany({ _id: { $in: meetingIds.map((id) => new ObjectId(id)) } });

  // Semantic memory of fake users in Qdrant.
  if (QDRANT_URL && fakeUserIds.length) {
    await fetch(`${QDRANT_URL}/collections/${MEMORY_COLLECTION}/points/delete?wait=true`, {
      method: 'POST', headers: qdrantHeaders(),
      body: JSON.stringify({ filter: { must: [{ key: 'userId', match: { any: fakeUserIds } }] } }),
    }).catch(() => {});
  }

  const deptIds = (await db.collection('departments').find(filterFor('departments'), { projection: { _id: 1 } }).toArray()).map((d) => d._id);
  if (deptIds.length) await db.collection('users').updateMany({}, { $pull: { departmentIds: { $in: deptIds } } });

  // People are kept (upserted by email in seedPeople) so 2FA enrolment, changed
  // passwords, connector links and mobile sessions survive a re-seed; --reset removes them.
  if (RESET_ONLY) await db.collection('users').deleteMany({ _id: { $in: users.map((u) => u._id) } });
  for (const c of TRACKED) if (!['kb_documents', 'conversations', 'meetings', 'meeting_notes', 'meeting_messages', 'meeting_summaries', 'meeting_records'].includes(c)) await db.collection(c).deleteMany(filterFor(c));
  await db.collection(MANIFEST).deleteOne({ _id: TAG });
  console.log(`reset: removed ${convIds.length} conversations, ${RESET_ONLY ? users.length : 0} users (${users.length} kept), ${kbDocs.length} KB docs, ${meetingIds.length} meetings`);
}

// -------------------------------------------------------------------- seed

async function seedPeople(db, bucket) {
  const roles = {};
  for (const r of await db.collection('roles').find({}).toArray()) roles[r.name] = r._id;
  for (const need of ['Owner', 'Admin', 'Member']) if (!roles[need]) throw new Error(`preset role ${need} missing`);

  const dept = {};
  for (const d of org.DEPARTMENTS) {
    const { insertedId } = await db.collection('departments').insertOne(tagged({
      name: d.name, description: d.description, createdAt: org.FOUNDED, updatedAt: new Date(),
    }));
    dept[d.key] = insertedId;
  }

  const ids = {};
  const names = {};
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const [i, p] of org.PEOPLE.entries()) {
    const avatarUrl = await storeFile(bucket, { name: `avatar-${p.key}.png`, mime: 'image/png', buf: await avatarPng(p.name, i, p.key) }, 'seed');
    const joined = new Date(org.FOUNDED.getTime() + Math.min(i * 4, 150) * 86400000);
    const profile = {
      displayName: p.name, isVerified: true, status: p.status || 'active',
      avatarUrl, bio: `${p.title} @ Lumen Software`, gender: p.gender,
      ...(p.phone ? { phoneNumber: p.phone, phoneVerified: true } : {}),
      roleId: roles[p.role], departmentIds: p.depts.map((k) => dept[k]), hideInfo: false, updatedAt: new Date(),
    };
    const existing = await db.collection('users').findOne({ email: p.email }, { projection: { _id: 1 } });
    let insertedId;
    if (existing) {
      // Re-seed: reset role/department/profile, keep password, mfa, sessions, tokens.
      await db.collection('users').updateOne({ _id: existing._id }, { $set: profile, $setOnInsert: {} });
      insertedId = existing._id;
    } else {
      ({ insertedId } = await db.collection('users').insertOne({
        ...profile, email: p.email, password: hash, phoneVerified: !!p.phone,
        trustedDevices: [], fcmTokens: [], socialLinks: {},
        showDateOfBirth: true, showPhoneNumber: true, showGender: true, createdAt: joined,
      }));
    }
    ids[p.key] = insertedId;
    names[p.key] = p.name;
  }
  // Pre-existing accounts (team Gmail / SSO logins, old test accounts): give
  // each a department, role and title. Never created, never deleted; a missing
  // account is skipped so conversations that mention it drop that member.
  for (const p of org.EXISTING_ACCOUNTS) {
    const existing = await db.collection('users').findOne({ email: p.email }, { projection: { _id: 1, displayName: 1 } });
    if (!existing) { console.warn(`   (existing account ${p.email} not found — skipped)`); continue; }
    await db.collection('users').updateOne({ _id: existing._id }, { $set: {
      ...(p.rename ? { displayName: p.rename } : {}),
      bio: `${p.title} @ Lumen Software`, gender: p.gender, status: 'active', hideInfo: false,
      roleId: roles[p.role], departmentIds: p.depts.map((k) => dept[k]), updatedAt: new Date(),
    } });
    ids[p.key] = existing._id;
    names[p.key] = p.rename || existing.displayName;
  }
  for (const d of org.DEPARTMENTS) {
    await db.collection('departments').updateOne({ _id: dept[d.key] }, { $set: { leadUserId: ids[d.lead] } });
  }

  for (const inv of org.INVITATIONS) {
    const created = realMinsAgo(inv.daysAgo * 24 * 60);
    await db.collection('invitations').insertOne(tagged({
      email: inv.email, roleId: roles[inv.role], departmentIds: inv.depts.map((k) => dept[k]),
      invitedBy: String(ids[inv.invitedBy]), tokenHash: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(created.getTime() + 7 * 24 * 3600 * 1000), status: inv.status,
      ...(inv.status === 'revoked' ? { revokedAt: minsAgo(inv.daysAgo * 24 * 60 - 120) } : {}),
      lastSentAt: created, sendCount: 1, locale: 'vi', createdAt: created, updatedAt: created,
    }));
  }

  const owner = String(ids.khang);
  for (const c of org.AI_CONTEXT) {
    await db.collection('ai_context_entries').insertOne(tagged({
      scope: c.scope, scopeId: c.scope === 'department' ? String(dept[c.dept]) : null,
      label: c.label, text: c.text, requiredCapability: c.cap, createdBy: owner, updatedBy: owner,
      createdAt: minsAgo(150 * 24 * 60), updatedAt: minsAgo(25 * 24 * 60),
    }));
  }
  const titles = Object.fromEntries(org.PEOPLE.map((p) => [p.key, p.title]));
  for (const [key, ctx] of Object.entries(org.USER_CONTEXT)) {
    const userId = String(ids[key]);
    await db.collection('ai_user_context').deleteOne({ userId });
    await db.collection('ai_user_context').insertOne(tagged({
      userId, jobTitle: titles[key], ...ctx, updatedBy: userId, createdAt: minsAgo(100 * 24 * 60), updatedAt: minsAgo(10 * 24 * 60),
    }));
  }
  return { ids, names, dept, roles };
}

async function seedSocial(db, { ids, names }) {
  for (const [a, b, status = 'accepted'] of FRIENDSHIPS) {
    const createdAt = minsAgo(status === 'pending' ? 6 * 60 : 120 * 24 * 60);
    await db.collection('friendships').insertOne(tagged({
      requesterId: String(ids[a]), recipientId: String(ids[b]), status, createdAt, updatedAt: createdAt,
    }));
    if (status === 'pending') {
      await db.collection('notifications').insertOne(tagged({
        recipientId: String(ids[b]), type: 'FRIEND_REQUEST', title: 'New friend request',
        body: `${names[a]} sent you a friend request`, actorId: String(ids[a]), actorName: names[a],
        readAt: null, createdAt, updatedAt: createdAt,
      }));
    }
  }
}

// November chapter (chapter-nov.js): absolute ICT times → "minutes before STORY_NOW"
// (negative = after it). Lines later than the moment the seed runs are dropped, so a
// seed run before demo day never shows messages from the future.
function withChapter(c) {
  const extra = (CHAPTER[c.key] || [])
    .map(({ at, ...m }) => ({ ...m, ts: ictTime(at) }))
    .sort((x, y) => x.ts - y.ts)
    .filter((m) => m.ts <= REAL_NOW)
    .map(({ ts, ...m }) => ({ ...m, ago: Math.round((STORY_NOW - ts) / 60000) }));
  const kb = [...(c.kb || []), ...(NOV_KB[c.key] || [])];
  return extra.length || kb.length !== (c.kb || []).length ? { ...c, messages: [...c.messages, ...extra], kb } : c;
}

// November documents the person keeps in their AI chat's knowledge base.
const NOV_KB = {
  'dm-khang-ai': ['seed_memo', 'okr_q4', 'appendix_pl02', 'postmortem', 'fleet_proposal', 'dd_checklist', 'scale_plan'],
  'dm-minh-ai': ['postmortem', 'quote_phuthinh', 'okr_q4', 'sprint14_report'],
  'dm-tri-ai': ['fleet_proposal', 'pilot_week45', 'driver_training'],
};

async function seedConversations(db, bucket, redis, ctx, { files, urlFor }) {
  const { ids, dept } = ctx;
  const uid = (k) => (k === 'ai' ? AI_BOT_ID : k === 'system' ? 'system' : String(ids[k]));
  const allPeople = org.PEOPLE.filter((p) => p.status !== 'blocked').map((p) => p.key);
  const leadOf = Object.fromEntries(org.DEPARTMENTS.map((d) => [d.key, d.lead]));

  const convIds = {};
  const aiMessages = [];
  const callEnds = [];
  const digestLogs = [];
  let kbCount = 0;
  let messageCount = 0;
  for (let c of CONVERSATIONS) {
    c = withChapter(c);
    const known = (k) => k === 'ai' || k === 'system' || ids[k];
    const members = (c.members === 'ALL' ? allPeople : c.members).filter(known);
    if (c.messages.some((m) => !known(m.from))) c = { ...c, messages: c.messages.filter((m) => known(m.from)) };
    // Background chatter + AI daily digests (filler.js), slotted between the scripted lines.
    const filled = withFiller(c, members, c.key === 'ann' ? 'dung' : leadOf[c.dept] || null);
    c = filled.conv;
    const participants = members.map(uid);
    const convId = new ObjectId();
    convIds[c.key] = convId;

    const { docs, pinned, kbFiles } = await buildMessages({ c, convId: String(convId), participants, uid, files, urlFor, minsAgo });
    // Documents the person added to this chat's knowledge base without posting them.
    for (const key of c.kb || []) {
      const f = files[key];
      kbFiles.push({ url: await urlFor(key, uid(c.kbBy || members[0])), name: f.name, mime: f.mime, userId: uid(c.kbBy || members[0]), createdAt: minsAgo(c.start - 60) });
    }
    const last = docs.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    messageCount += docs.length;
    for (const d of filled.digestDates) digestLogs.push({ conversationId: String(convId), digestDate: d });
    for (const [i, d] of docs.entries()) {
      const m = d.type === 'system' && /^system\.call\.ended:(audio|video):(\d+)$/.exec(d.content);
      if (!m) continue;
      const next = docs[i + 1];
      callEnds.push({ convId: String(convId), type: c.type, participants, endedAt: d.createdAt, media: m[1], secs: Number(m[2]),
        summaryMessageId: next && next.type === 'meeting_summary' ? String(next._id) : null });
    }
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
        systemPromptPrefix: c.persona.prefix, createdBy: uid(c.createdBy), updatedAt: minsAgo(60 * 24 * 60),
      }));
    }

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
  return { convIds, aiMessages, kbCount, callEnds, digestLogs, messageCount };
}

async function seedAiData(db, { ids }, { convIds, aiMessages }) {
  for (const r of REMINDERS) {
    await db.collection('reminders').insertOne(tagged({
      userId: String(ids[r.user]), conversationId: String(convIds[r.conv]), text: r.text,
      ...(() => {
        const at = (r.real ? REAL_NOW : now) + r.inMins * 60000;
        const done = !!r.done || at < REAL_NOW; // never leave a past reminder for the scheduler to fire
        return { remindAt: new Date(at), done, notified: done };
      })(),
      attempts: 0, createdAt: r.real ? realMinsAgo(24 * 60) : minsAgo(3 * 24 * 60), _class: 'com.platform.chatservice.model.Reminder',
    }));
  }
  for (const r of REMINDERS_NOV) {
    if (!ids[r.user] || !convIds[r.conv]) continue;
    const at = ictTime(r.at);
    const done = at < REAL_NOW;
    await db.collection('reminders').insertOne(tagged({
      userId: String(ids[r.user]), conversationId: String(convIds[r.conv]), text: r.text, remindAt: new Date(at), done, notified: done,
      attempts: 0, createdAt: new Date(Math.min(REAL_NOW, at) - 2 * 86400000), _class: 'com.platform.chatservice.model.Reminder',
    }));
  }
  for (const m of MEMORIES) {
    await db.collection('ai_memories').insertOne(tagged({
      conversationId: String(convIds[m.conv]), userId: String(ids[m.user]), summary: m.summary,
      keyFacts: m.keyFacts, messageCount: m.messageCount, updatedAt: minsAgo(3 * 60),
    }));
  }

  // 30 days of token usage for the people who use the assistant most.
  const heavy = ['khang', 'minh', 'tri', 'huy', 'dung', 'lananh', 'nhung', 'trang', 'thinh', 'nam', 'tuan', 'dat'];
  for (const [i, key] of heavy.entries()) {
    for (let d = 0; d < 30; d++) {
      const day = new Date(REAL_NOW - d * 86400000); // the usage meter reads the real month
      if ([0, 6].includes(day.getDay()) && d % 3) continue;
      const base = 3000 + ((i * 7919 + d * 104729) % 22000);
      await db.collection('token_usage').updateOne(
        { userId: String(ids[key]), date: day.toISOString().slice(0, 10) },
        { $setOnInsert: tagged({ inputTokens: base * 6, outputTokens: base, requestCount: 2 + (base % 13), updatedAt: day }) },
        { upsert: true },
      );
    }
  }

  for (const [i, m] of aiMessages.entries()) {
    const voter = m.members.find((p) => p !== AI_BOT_ID);
    await db.collection('ai_feedback').insertOne(tagged({
      messageId: String(m._id), conversationId: m.conversationId, userId: voter,
      rating: i % 5 === 4 ? 'down' : 'up', comment: i % 5 === 4 ? 'Thiếu nguồn trích dẫn' : null,
      createdAt: m.createdAt, updatedAt: m.createdAt,
    }));
  }
}

async function seedMemoryFacts({ ids }, { convIds }) {
  if (!QDRANT_URL || !VOYAGE_API_KEY) { console.warn('!! QDRANT_URL / VOYAGE_API_KEY missing — semantic memory facts skipped'); return 0; }
  const info = await fetch(`${QDRANT_URL}/collections/${MEMORY_COLLECTION}`, { headers: qdrantHeaders() });
  if (!info.ok) { console.warn(`!! Qdrant collection ${MEMORY_COLLECTION} not found (${info.status}) — facts skipped`); return 0; }
  const points = [];
  for (const [key, facts] of Object.entries(MEMORY_FACTS)) {
    const vectors = await embed(facts);
    const conv = convIds[`dm-${key}-ai`] || convIds['dm-khang-ai'];
    facts.forEach((text, i) => points.push({
      id: crypto.randomUUID(), vector: vectors[i],
      payload: { userId: String(ids[key]), conversationId: String(conv), text, source: 'extraction', createdAt: now - (30 - i) * 86400000 },
    }));
  }
  const res = await fetch(`${QDRANT_URL}/collections/${MEMORY_COLLECTION}/points?wait=true`, {
    method: 'PUT', headers: qdrantHeaders(), body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Qdrant upsert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return points.length;
}

async function seedAudit(db, { ids, names }) {
  const A = (actor, action, targetType, meta, daysAgo) => ({ actor, action, targetType, meta, daysAgo });
  const entries = [
    A('khang', 'workspace.update', 'workspace', { field: 'name', value: org.WORKSPACE.name }, 194),
    A('khang', 'department.create', 'department', { name: 'Phòng RetailOS' }, 193),
    A('khang', 'department.create', 'department', { name: 'Phòng FleetPro' }, 193),
    A('oanh', 'member.invite', 'invitation', { email: `minh.nguyen@${org.DOMAIN}` }, 190),
    A('khang', 'member.update', 'user', { field: 'role', from: 'Member', to: 'Admin', user: names.tuan }, 185),
    A('tuan', 'connector.connect', 'connection', { provider: 'calendar', scope: 'workspace' }, 150),
    A('khang', 'ai_context.update', 'ai_context', { label: 'Khung lương (mật)' }, 150),
    A('dung', 'workspace.update', 'workspace', { field: 'connectorAllowList', value: ['notion', 'gmail', 'calendar'] }, 120),
    A('oanh', 'member.invite', 'invitation', { email: `ngan.huynh@${org.DOMAIN}` }, 60),
    A('lananh', 'member.invite', 'invitation', { email: `intern.sales@${org.DOMAIN}` }, 20),
    A('lananh', 'invitation.revoke', 'invitation', { email: `intern.sales@${org.DOMAIN}` }, 18),
    A('khang', 'role.update', 'role', { role: 'Member', capability: 'VIEW_INTERNAL_CONTEXT', value: false }, 15),
    A('minh', 'sensitive_skill.run', 'skill', { tool: 'calendar.create_event', title: 'Demo go-live RetailOS — Minh Châu' }, 1),
    A('oanh', 'member.invite', 'invitation', { email: `backend.fleet@${org.DOMAIN}` }, 2),
  ];
  await db.collection('auditlogs').insertMany(entries.map((e) => tagged({
    actorId: String(ids[e.actor]), actorName: names[e.actor], action: e.action, targetType: e.targetType,
    meta: e.meta, createdAt: minsAgo(e.daysAgo * 24 * 60),
  })));
}

async function seedExtras(db, { ids, names }, { callEnds, digestLogs }) {
  // Calls: one call_sessions row per "call ended" pill, linked to its AI summary card.
  for (const [i, c] of callEnds.entries()) {
    const people = c.participants.filter((p) => !p.startsWith('ai-bot') && p !== 'system');
    const joined = c.type === 'direct' ? people : people.slice(0, Math.min(people.length, 4 + (i % 3)));
    const startedAt = new Date(c.endedAt.getTime() - c.secs * 1000);
    const starter = joined[i % joined.length];
    const nameOf = (uid) => names[Object.keys(ids).find((k) => String(ids[k]) === uid)] || '';
    await db.collection('call_sessions').insertOne(tagged({
      callId: crypto.randomUUID(), conversationId: c.convId, startedBy: starter, startedByName: nameOf(starter),
      startedAt, endedAt: c.endedAt, transport: 'sfu', kind: c.type === 'direct' ? 'direct' : 'group', media: c.media,
      aiNotetaker: !!c.summaryMessageId,
      participants: joined.map((u, j) => ({
        userId: u, displayName: nameOf(u), sid: `PA_${crypto.randomBytes(6).toString('hex')}`,
        joinedAt: new Date(startedAt.getTime() + j * 20000), acceptedAt: new Date(startedAt.getTime() + j * 20000),
        leftAt: c.endedAt,
      })),
      ...(c.summaryMessageId ? { summaryMessageId: c.summaryMessageId } : {}), version: 0,
      _class: 'com.platform.chatservice.model.CallSession',
    }));
  }

  // Daily digests already posted (filler.js) — the cron's idempotency log.
  for (const d of digestLogs) await db.collection('ai_digest_log').insertOne(tagged({ ...d, createdAt: new Date(`${d.digestDate}T01:00:00Z`) }));

  // Connected tools: expired / revoked only (fake tokens are never used).
  for (const c of org.CONNECTIONS) {
    const junk = () => crypto.randomBytes(16).toString('hex');
    const at = minsAgo(c.daysAgo * 24 * 60);
    await db.collection('user_connections').insertOne(tagged({
      userId: String(ids[c.user]), provider: c.provider, status: c.status, scope: c.scope, scopes: [],
      actionGroups: ['view', 'create', 'edit', 'delete'], encryptedTokens: { iv: junk(), tag: junk(), data: junk() },
      accountLabel: c.label, lastUsedAt: minsAgo((c.daysAgo - 30) * 24 * 60), createdAt: at, updatedAt: at,
    }));
  }

  // Skills: upsert so a person's own toggles survive; only rows the seed created carry the tag.
  for (const [key, skills] of Object.entries(org.SKILLS)) {
    for (const skillId of skills) {
      await db.collection('user_skills').updateOne(
        { userId: String(ids[key]), skillId },
        { $set: { enabled: true, updatedAt: minsAgo(40 * 24 * 60) }, $setOnInsert: { seedTag: TAG, createdAt: minsAgo(60 * 24 * 60) } },
        { upsert: true },
      );
    }
  }

  for (const [a, b] of org.BLOCKS) {
    if (!ids[a] || !ids[b]) continue;
    await db.collection('user_blocks').insertOne(tagged({
      blockerId: String(ids[a]), blockedId: String(ids[b]), createdAt: minsAgo(20 * 24 * 60),
      _class: 'com.platform.chatservice.model.UserBlock',
    }));
  }
}

// -------------------------------------------------------------------- main

(async () => {
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db('platform');
  const bucket = new GridFSBucket(db);
  const redis = await connectRedis();
  if (!redis) console.warn(`!! Redis unreachable — KB docs will stay "pending" (not embedded)`);

  await reset(db, bucket, redis);
  if (!RESET_ONLY) {
    await db.collection('workspaces').updateOne({}, { $set: { ...org.WORKSPACE, updatedAt: new Date() } });
    const ctx = await seedPeople(db, bucket);
    await seedSocial(db, ctx);
    const files = { ...(await buildFiles()), ...(await buildNovFiles()), ...buildW46Files() };
    const fileUrls = {};
    const urlFor = async (key, uploader) => (fileUrls[key] ??= await storeFile(bucket, files[key], uploader));
    const convs = await seedConversations(db, bucket, redis, ctx, { files, urlFor });
    const meetings = await seedMeetings(db, ctx, { files, urlFor, minsAgo });
    await seedAiData(db, ctx, convs);
    const facts = await seedMemoryFacts(ctx, convs).catch((e) => { console.warn(`!! memory facts: ${e.message}`); return 0; });
    await seedAudit(db, ctx);
    await seedExtras(db, ctx, convs);
    // Only Lumen-created people go in the manifest: pre-existing accounts must
    // never be treated as fake (their own chats would be wiped, --reset would delete them).
    await writeManifest(db, org.PEOPLE.map((p) => String(ctx.ids[p.key])));

    console.log(`\nLumen Software seeded:`);
    console.log(`  ${org.DEPARTMENTS.length} departments, ${org.PEOPLE.length} people, ${org.INVITATIONS.length} invitations`);
    console.log(`  ${CONVERSATIONS.length} conversations, ${convs.messageCount} messages, ${convs.callEnds.length} call sessions, ${convs.digestLogs.length} digests`);
    console.log(`  ${org.CONNECTIONS.length} connections (expired/revoked), ${Object.values(org.SKILLS).flat().length} skills on, ${org.BLOCKS.length} blocks`);
    console.log(`  ${CONVERSATIONS.length} conversations, ${convs.aiMessages.length} AI answers, ${convs.kbCount} KB documents ${redis ? 'queued for embedding' : '(pending)'}`);
    console.log(`  ${meetings.count} meetings (${meetings.summaries} AI summaries, ${meetings.records} AI records, ${meetings.groups} meeting groups), ${facts} memory facts`);
    console.log(`\n  login: <email> / ${PASSWORD}`);
    for (const p of org.PEOPLE.filter((p) => p.team)) console.log(`    ${p.team.padEnd(6)} ${p.email.padEnd(30)} ${p.role.padEnd(7)} ${p.title}`);
  }
  if (redis) redis.disconnect();
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
