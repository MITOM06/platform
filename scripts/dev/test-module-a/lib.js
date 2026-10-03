// Shared helpers for the Module A end-to-end test: HTTP + auth, the AI stream
// listener (Redis `ai:response:<conversationId>`), Mongo access and the reporter
// that prints every case as Account / Steps / Expected / Actual / Result.

const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '../../..');
const { MongoClient, ObjectId } = require(path.join(ROOT, 'node_modules/mongodb'));
const Redis = require(path.join(ROOT, 'node_modules/ioredis'));

const CFG = {
  AUTH: process.env.AUTH_URL || 'http://localhost:3001',
  CHAT: process.env.CHAT_URL || 'http://localhost:8080',
  AI: process.env.AI_URL || 'http://localhost:3002',
  MONGO: process.env.MONGO_URI || 'mongodb://localhost:27018/platform?directConnection=true',
  REDIS: process.env.REDIS_URL || 'redis://localhost:6379',
  PASSWORD: 'Devpass123!',
  AI_BOT: 'ai-bot-000000000000000000000001',
  AI_TIMEOUT_MS: 150000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now().toString(36).slice(-5).toUpperCase(); // unique per run

// ------------------------------------------------------------------ console

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const results = [];
let current = null;

function section(title) {
  console.log(`\n${C.b}${C.c}████ ${title} ${'█'.repeat(Math.max(4, 70 - title.length))}${C.x}`);
}

/** Start a case. `spec` = { account, steps: [..], expected } — printed before running. */
function begin(id, title, spec) {
  current = { id, title, ...spec, startedAt: Date.now() };
  console.log(`\n${C.b}━━ ${id}  ${title}${C.x}`);
  if (spec.account) console.log(`  ${C.d}Tài khoản :${C.x} ${spec.account}`);
  (spec.steps || []).forEach((s, i) => console.log(`  ${C.d}${i === 0 ? 'Các bước  :' : '           '}${C.x} ${i + 1}. ${s}`));
  console.log(`  ${C.d}Kỳ vọng   :${C.x} ${spec.expected}`);
}

/** Finish the current case. status: PASS | FAIL | SKIP | MANUAL */
function end(status, actual, hint) {
  const icon = { PASS: `${C.g}✅ PASS`, FAIL: `${C.r}❌ FAIL`, SKIP: `${C.y}⏭  SKIP`, MANUAL: `${C.y}📝 MANUAL` }[status];
  const secs = ((Date.now() - current.startedAt) / 1000).toFixed(1);
  console.log(`  ${C.d}Thực tế   :${C.x} ${actual}`);
  console.log(`  ${C.d}Kết quả   :${C.x} ${icon}${C.x} ${C.d}(${secs}s)${C.x}`);
  if (status === 'FAIL' && hint) console.log(`  ${C.y}Cách xử lý:${C.x} ${hint}`);
  results.push({ ...current, status, actual, hint: status === 'FAIL' ? hint : undefined, secs });
  current = null;
}

/** Run a case body; any thrown error is a FAIL with the error as "actual". */
async function test(id, title, spec, body) {
  begin(id, title, spec);
  try {
    const r = await body();
    end(r.status || (r.pass ? 'PASS' : 'FAIL'), r.actual, r.hint || spec.hint);
  } catch (e) {
    end('FAIL', `Lỗi khi chạy: ${e.message}`, spec.hint);
  }
}

const short = (s, n = 160) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
/** Case/accent-insensitive "contains", also ignoring 1.287 vs 1287 digit grouping. */
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/(\d)[.,\s](?=\d{3}\b)/g, '$1');
const has = (text, needle) => norm(text).includes(norm(needle));

// --------------------------------------------------------------- data access

let mongo;
let db;
let redis;
async function connect() {
  mongo = await MongoClient.connect(CFG.MONGO);
  db = mongo.db('platform');
  redis = new Redis(CFG.REDIS, { maxRetriesPerRequest: 2 });
  return { db, redis };
}
async function disconnect() {
  redis?.disconnect();
  await mongo?.close();
}

// ---------------------------------------------------------------------- http

async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json, text };
}

const tokens = {};
/** Login (cached). Retries through the auth-service login throttle (429). */
async function login(email) {
  if (tokens[email]) return tokens[email];
  for (let i = 0; i < 12; i++) {
    const r = await api(null, 'POST', `${CFG.AUTH}/auth/login`, { email, password: CFG.PASSWORD });
    if (r.json?.accessToken) {
      const payload = JSON.parse(Buffer.from(r.json.accessToken.split('.')[1], 'base64url').toString());
      tokens[email] = { token: r.json.accessToken, id: payload.sub, perms: payload.perms || [], email };
      return tokens[email];
    }
    if (r.status !== 429) throw new Error(`login ${email} → HTTP ${r.status} ${short(r.text, 120)}`);
    process.stdout.write(`${C.d}   (login bị giới hạn tần suất, chờ 10s…)${C.x}\n`);
    await sleep(10000);
  }
  throw new Error(`login ${email}: still rate-limited`);
}

async function upload(user, name, mime, buf) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), name);
  const res = await fetch(`${CFG.CHAT}/api/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${user.token}` }, body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) throw new Error(`upload ${name} → HTTP ${res.status}`);
  return { url: json.url, name, size: buf.length, mime };
}

async function send(user, conversationId, content, type = 'text') {
  const r = await api(user.token, 'POST', `${CFG.CHAT}/api/messages`, { conversationId, content, type });
  if (r.status >= 300 || !r.json?.id) throw new Error(`send → HTTP ${r.status} ${short(r.text, 120)}`);
  return r.json;
}

/** Get-or-create the user's 1-1 chat with the AI bot (201, or 409 + existing id). */
async function aiDm(user) {
  const r = await api(user.token, 'POST', `${CFG.CHAT}/api/conversations`, { participantId: CFG.AI_BOT });
  const id = r.json?.id || r.json?.conversationId;
  if (!id) throw new Error(`AI DM → HTTP ${r.status} ${short(r.text, 120)}`);
  return id;
}

async function createGroup(user, name, participantIds, departmentId) {
  return api(user.token, 'POST', `${CFG.CHAT}/api/conversations/group`, { name, participantIds, ...(departmentId ? { departmentId } : {}) });
}

/**
 * Send `content` and collect the AI stream for that conversation until
 * AI_STREAM_DONE / AI_STREAM_ERROR. Subscribes BEFORE sending so no chunk is missed.
 */
async function askAi(user, conversationId, content, timeoutMs = CFG.AI_TIMEOUT_MS) {
  const sub = new Redis(CFG.REDIS);
  const channel = `ai:response:${conversationId}`;
  const out = { chunks: 0, text: '', done: null, error: null, firstChunkMs: null, totalMs: null, sent: null };
  const t0 = Date.now();
  const finished = new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    sub.on('message', (_ch, raw) => {
      let ev;
      try { ev = JSON.parse(raw); } catch { return; }
      if (ev.type === 'AI_STREAM_CHUNK') {
        out.chunks++;
        out.text += ev.chunk || '';
        if (out.firstChunkMs === null) out.firstChunkMs = Date.now() - t0;
      } else if (ev.type === 'AI_STREAM_DONE') {
        out.done = ev;
        clearTimeout(timer);
        resolve('done');
      } else if (ev.type === 'AI_STREAM_ERROR') {
        out.error = ev;
        clearTimeout(timer);
        resolve('error');
      }
    });
  });
  await sub.subscribe(channel);
  out.sent = await send(user, conversationId, content);
  out.outcome = await finished;
  out.totalMs = Date.now() - t0;
  if (out.done?.fullContent) out.text = out.done.fullContent;
  sub.disconnect();
  return out;
}

/** The persisted AI message answering `sent` (needed for /trace). */
async function aiMessageAfter(user, conversationId, sent, waitMs = 15000) {
  const sentAt = new Date(sent.createdAt).getTime();
  for (let waited = 0; waited <= waitMs; waited += 1000) {
    const r = await api(user.token, 'GET', `${CFG.CHAT}/api/conversations/${conversationId}/messages?size=10`);
    const items = Array.isArray(r.json) ? r.json : r.json?.content || [];
    const hit = items.find((m) => m.type === 'ai' && new Date(m.createdAt).getTime() > sentAt);
    if (hit) return hit;
    await sleep(1000);
  }
  return null;
}

const describeAi = (a) => {
  if (a.outcome === 'timeout') return `HẾT GIỜ sau ${(a.totalMs / 1000).toFixed(0)}s — không có AI_STREAM_DONE/ERROR`;
  if (a.error) return `AI_STREAM_ERROR code=${a.error.code} "${short(a.error.error, 90)}"`;
  return `"${short(a.text)}"`;
};

async function waitFor(fn, { timeoutMs = 60000, everyMs = 2000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(everyMs);
  }
}

// -------------------------------------------------------------------- report

function summary() {
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n${C.b}══════════════════ TỔNG KẾT MODULE A ══════════════════${C.x}`);
  for (const r of results) {
    const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭ ', MANUAL: '📝' }[r.status];
    console.log(`  ${icon} ${r.id.padEnd(6)} ${r.title}`);
  }
  console.log(`\n  ${C.g}PASS ${count('PASS')}${C.x}  ${C.r}FAIL ${count('FAIL')}${C.x}  ${C.y}SKIP ${count('SKIP')}  MANUAL ${count('MANUAL')}${C.x}`);
  const fails = results.filter((r) => r.status === 'FAIL');
  if (fails.length) {
    console.log(`\n${C.r}${C.b}Cần khắc phục:${C.x}`);
    fails.forEach((f) => console.log(`  ❌ ${f.id} ${f.title}\n     → ${f.hint || 'xem log case ở trên'}`));
  }
  return { pass: count('PASS'), fail: count('FAIL') };
}

function writeReport(file) {
  const lines = [
    `# Module A — kết quả test E2E (${new Date().toISOString()})`, '',
    '| Mã | Kiểm tra | KQ | Thực tế |', '|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.title} | ${{ PASS: '✅', FAIL: '❌', SKIP: '⏭', MANUAL: '📝' }[r.status]} | ${String(r.actual).replace(/\|/g, '/').replace(/\n/g, ' ')} |`),
    '', '## Chi tiết', '',
    ...results.flatMap((r) => [
      `### ${r.id} — ${r.title}`, '',
      r.account ? `- **Tài khoản:** ${r.account}` : '',
      ...(r.steps || []).map((s, i) => `${i === 0 ? '- **Các bước:**\n' : ''}  ${i + 1}. ${s}`),
      `- **Kỳ vọng:** ${r.expected}`, `- **Thực tế:** ${r.actual}`, `- **Kết quả:** ${r.status}`,
      r.hint ? `- **Cách xử lý:** ${r.hint}` : '', '',
    ]).filter((l) => l !== ''),
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n'));
}

module.exports = {
  CFG, RUN, ROOT, ObjectId, sleep, short, has, norm, section, test, results, summary, writeReport,
  connect, disconnect, api, login, upload, send, aiDm, createGroup, askAi, aiMessageAfter, describeAi, waitFor,
  get db() { return db; }, get redis() { return redis; },
};
