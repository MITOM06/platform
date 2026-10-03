#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Module A (AI Assistant, Memory & RAG) — end-to-end test for tasks A1..A6,
// against the LOCAL dev stack with real Anthropic + Voyage keys.
//
//   node scripts/dev/test-module-a/index.js                 # all of A1–A6
//   node scripts/dev/test-module-a/index.js --only A2,A5    # some sections
//   node scripts/dev/test-module-a/index.js --keep          # keep test chats
//   node scripts/dev/test-module-a/index.js --digest-setup  # A4.5 step 1
//   node scripts/dev/test-module-a/index.js --digest-check  # A4.5 step 2
//
// Prereqs: ./scripts/dev/up.sh (stack up) + node scripts/dev/seed-company/index.js
// Every case prints Account / Steps / Expected / Actual / Result, and a FAIL also
// prints where to look. A markdown report is written to .dev-logs/.
// Dev-only helper — lives under scripts/dev/, never promoted to main.
// ─────────────────────────────────────────────────────────────────────────────
const path = require('node:path');
const { execSync } = require('node:child_process');
const L = require('./lib');
const { a1, a2 } = require('./cases-a1-a2');
const { a3, a4 } = require('./cases-a3-a4');
const { a5, a6 } = require('./cases-a5-a6');

const { CFG } = L;
const arg = (n) => process.argv.includes(n);
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const ONLY = arg('--only') && onlyArg ? onlyArg.toUpperCase().split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);

const ACCOUNTS = {
  dev: 'dev@pon.local', alice: 'alice@pon.local', quan: 'quan.nguyen@novatech.local',
  nam: 'nam.le@novatech.local', son: 'son.ho@novatech.local', lan: 'lan.vo@novatech.local',
  minh: 'minh.phan@novatech.local', thu: 'thu.ta@novatech.local',
};

async function preflight() {
  const checks = [['auth-service', `${CFG.AUTH}/health`], ['chat-service', `${CFG.CHAT}/health`], ['ai-service', `${CFG.AI}/health`]];
  for (const [name, url] of checks) {
    const r = await fetch(url).then((x) => x.status, () => 0);
    if (r !== 200) throw new Error(`${name} không phản hồi (${url} → ${r}). Chạy ./scripts/dev/up.sh`);
  }
  if (!(await L.db.collection('users').findOne({ email: ACCOUNTS.son }))) {
    throw new Error('Chưa có dữ liệu công ty ảo. Chạy: node scripts/dev/seed-company/index.js');
  }
}

async function setup() {
  const ctx = { cleanup: { convs: [], reminders: [], callIds: [] } };
  for (const [k, email] of Object.entries(ACCOUNTS)) ctx[k] = await L.login(email);
  ctx.devDm = await L.aiDm(ctx.dev);
  ctx.groupName = `[TEST-A] ${L.RUN}`;
  const g = await L.createGroup(ctx.dev, ctx.groupName, [ctx.alice.id]);
  if (!g.json?.id) throw new Error(`Tạo nhóm test thất bại: HTTP ${g.status} ${L.short(g.text, 120)}`);
  ctx.group = g.json.id;
  ctx.cleanup.convs.push(g.json.id);
  const conv = async (name, member) => String((await L.db.collection('conversations').findOne({ name, participants: member.id }))?._id || '');
  ctx.engGroup = await conv('#ky-thuat', ctx.dev);
  ctx.salesGroup = await conv('#kinh-doanh', ctx.son);
  ctx.depts = {};
  for (const [k, name] of [['eng', 'Kỹ thuật'], ['sales', 'Kinh doanh']]) {
    ctx.depts[k] = String((await L.db.collection('departments').findOne({ name }))?._id || '');
  }
  if (!ctx.engGroup || !ctx.salesGroup) throw new Error('Không thấy nhóm #ky-thuat / #kinh-doanh — chạy lại seed-company');
  return ctx;
}

async function cleanup(ctx) {
  const convs = (await L.db.collection('conversations').find({ name: { $regex: '^\\[TEST-A\\]' } }, { projection: { _id: 1 } }).toArray()).map((c) => String(c._id));
  const ids = [...new Set([...convs, ...ctx.cleanup.convs])];
  const kb = await L.db.collection('kb_documents').find({ conversationId: { $in: ids } }, { projection: { documentId: 1 } }).toArray();
  for (const d of kb) await L.redis.publish('kb:delete', JSON.stringify({ documentId: d.documentId }));
  await L.db.collection('kb_documents').deleteMany({ conversationId: { $in: ids } });
  await L.db.collection('messages').deleteMany({ conversationId: { $in: ids } });
  for (const c of ['ai_memories', 'ai_personas', 'call_sessions']) await L.db.collection(c).deleteMany({ conversationId: { $in: ids } });
  await L.db.collection('conversations').deleteMany({ _id: { $in: ids.map((i) => new L.ObjectId(i)) } });
  for (const id of ctx.cleanup.reminders) await L.api(ctx.dev.token, 'DELETE', `${CFG.CHAT}/api/reminders/${id}`);
  for (const id of ctx.cleanup.callIds) await L.redis.del(`call:transcript:${id}`);
  console.log(`\n🧹 Đã dọn ${ids.length} nhóm test, ${kb.length} tài liệu KB, ${ctx.cleanup.reminders.length} reminder (dùng --keep để giữ lại).`);
}

// ------------------------------------------------------------- digest (A4.5)

function containerHour() {
  try { return parseInt(execSync('docker exec ai-service date +%H', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10); } catch { return new Date().getUTCHours(); }
}

async function digestSetup() {
  const quan = await L.login(ACCOUNTS.quan);
  const dev = await L.login(ACCOUNTS.dev);
  const ws = (await L.api(quan.token, 'GET', `${CFG.AUTH}/admin/workspace`)).json || {};
  const hour = (containerHour() + 1) % 24;
  await L.db.collection('dev_test_state').replaceOne({ _id: 'digest' }, { _id: 'digest', original: ws.aiSettings || {}, hour }, { upsert: true });
  const p = await L.api(quan.token, 'PATCH', `${CFG.AUTH}/admin/workspace`, { aiSettings: { ...(ws.aiSettings || {}), dailyDigestEnabled: true, dailyDigestHour: hour } });
  // Guarantee "yesterday" activity in dev's AI chat (container-local day = UTC).
  const dm = await L.aiDm(dev);
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1); y.setUTCHours(10, 0, 0, 0);
  await L.db.collection('messages').insertOne({ conversationId: dm, senderId: dev.id, type: 'text', content: 'Hôm qua: nhớ chốt báo giá ABC và gửi biên bản họp sprint', readBy: [dev.id], reactions: [], recalled: false, deletedFor: [], mentions: [], createdAt: y, testRun: 'digest' });
  const vn = (hour + 7) % 24;
  console.log(`A4.5 setup: PATCH /admin/workspace → ${p.status}. Digest sẽ chạy lúc ${String(hour).padStart(2, '0')}:00 UTC (= ${String(vn).padStart(2, '0')}:00 giờ VN).`);
  console.log(`Sau ${String(vn).padStart(2, '0')}:02 giờ VN chạy:  node scripts/dev/test-module-a/index.js --digest-check`);
}

async function digestCheck() {
  const quan = await L.login(ACCOUNTS.quan);
  const dev = await L.login(ACCOUNTS.dev);
  const state = await L.db.collection('dev_test_state').findOne({ _id: 'digest' });
  const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
  const digestDate = y.toISOString().slice(0, 10);
  const dm = await L.aiDm(dev);
  await L.test('A4.5', 'Daily digest gửi đúng lịch', {
    account: `${ACCOUNTS.dev} / ${CFG.PASSWORD}`,
    steps: [`Đã đặt dailyDigestHour=${state?.hour} (UTC) bằng --digest-setup`, 'Mở chat 1-1 với AI của dev'],
    expected: `ai_digest_log có bản ghi digestDate=${digestDate} cho chat 1-1 của dev và có 1 tin AI tóm tắt mới`,
    hint: 'Không có log → cron chưa tới giờ (container dùng UTC), dailyDigestEnabled=false, hoặc xem `docker logs ai-service | grep -i digest`.',
  }, async () => {
    const log = await L.db.collection('ai_digest_log').findOne({ conversationId: dm, digestDate });
    const since = new Date(); since.setUTCMinutes(0, 0, 0);
    const msg = await L.db.collection('messages').findOne({ conversationId: dm, type: 'ai', createdAt: { $gte: since } });
    return { pass: !!(log && msg), actual: `digest_log=${log ? 'có' : 'không'}; tin AI mới: ${msg ? `"${L.short(msg.content, 100)}"` : 'không'}` };
  });
  if (state) await L.api(quan.token, 'PATCH', `${CFG.AUTH}/admin/workspace`, { aiSettings: state.original });
  await L.db.collection('messages').deleteMany({ testRun: 'digest' });
  L.summary();
}

// --------------------------------------------------------------------- main

(async () => {
  await L.connect();
  try {
    if (arg('--digest-setup')) return await digestSetup();
    if (arg('--digest-check')) return await digestCheck();
    await preflight();
    console.log(`Module A E2E — run ${L.RUN} — ${new Date().toLocaleString('vi-VN')}`);
    const ctx = await setup();
    console.log(`Nhóm test: "${ctx.groupName}" (${ctx.group}); chat AI 1-1 của dev: ${ctx.devDm}`);
    try {
      if (want('A1')) await a1(ctx);
      if (want('A2')) await a2(ctx);
      if (want('A3')) await a3(ctx);
      if (want('A4')) await a4(ctx);
      if (want('A5')) await a5(ctx);
      if (want('A6')) await a6(ctx);
    } finally {
      if (!arg('--keep')) await cleanup(ctx);
    }
    const { fail } = L.summary();
    const file = path.join(L.ROOT, '.dev-logs', `module-a-report-${L.RUN}.md`);
    L.writeReport(file);
    console.log(`\n📄 Báo cáo: ${path.relative(process.cwd(), file)}`);
    process.exitCode = fail ? 1 : 0;
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    process.exitCode = 2;
  } finally {
    await L.disconnect();
  }
})();
