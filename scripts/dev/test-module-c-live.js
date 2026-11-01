#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Module C (MCP Connectors & Skills) — LIVE checks for C1 (authorize URLs) and
// C2 (custom MCP + allow-list), against the LOCAL dev stack.
//
//   node scripts/dev/test-module-c-live.js
//
// Complements test-module-c.sh, which only probes status codes. This one
// exercises the real flows and CLEANS UP after itself: the custom MCP it adds
// is deleted and the workspace allow-list is restored in `finally`.
//
// Needs: the stack up and seeded (dev=Owner, alice=Member), network access to
// https://mcp.deepwiki.com (the public BYO server used for discovery).
// Dev-only helper — lives under scripts/dev/, never promoted to main.
// ─────────────────────────────────────────────────────────────────────────────
const lib = require('./test-module-a/lib.js');

const AUTH = process.env.AUTH_URL || 'http://localhost:3001';
const CONN = process.env.CONNECTOR_URL || 'http://localhost:3003';
const BYO_SERVER = { url: 'https://mcp.deepwiki.com/mcp', authType: 'none' };

let pass = 0;
let fail = 0;
const check = (cond, msg, extra = '') => {
  console.log(`  ${cond ? '✅ PASS' : '❌ FAIL'}: ${msg}${extra ? `  [${extra}]` : ''}`);
  if (cond) pass++;
  else fail++;
};

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, json };
}

/** C1: every catalog connector either hands out a URL with a real client_id or refuses cleanly. */
async function checkAuthorizeUrls(owner) {
  console.log('\n########## C1 — authorize URLs ##########');
  for (const [provider, host] of [
    ['notion', 'api.notion.com'],
    ['gmail', 'accounts.google.com'],
    ['calendar', 'accounts.google.com'],
  ]) {
    const r = await call(owner, 'GET', `${CONN}/oauth/${provider}/start`);
    if (r.json?.authorizeUrl) {
      const u = new URL(r.json.authorizeUrl);
      check(u.host === host, `${provider}: authorize URL points at ${host}`);
      check(!!u.searchParams.get('client_id'), `${provider}: client_id is not empty`);
      check(
        u.searchParams.get('redirect_uri') === `${CONN}/oauth/${provider}/callback`,
        `${provider}: redirect_uri is the connector-service callback`,
      );
    } else {
      check(
        r.json?.code === 'CONNECTOR_NOT_CONFIGURED',
        `${provider}: no credentials on this machine → clean CONNECTOR_NOT_CONFIGURED refusal`,
        `HTTP ${r.status} ${r.json?.code ?? ''}`,
      );
    }
  }
}

/** C2: admin adds a BYO custom MCP, a Member cannot, and the allow-list gates connecting. */
async function checkCustomMcpAndAllowList(owner, member) {
  console.log('\n########## C2 — custom MCP & allow-list ##########');
  const ws = await call(owner, 'GET', `${AUTH}/admin/workspace`);
  const original = ws.json.connectorAllowList;
  let createdId = null;
  try {
    const discover = await call(owner, 'POST', `${CONN}/custom-mcp/discover`, BYO_SERVER);
    check(
      discover.status < 300 && discover.json?.tools?.length > 0,
      'Owner: discover returns the server tools',
      `HTTP ${discover.status}, tools=${discover.json?.tools?.length}`,
    );
    const created = await call(owner, 'POST', `${CONN}/custom-mcp`, { ...BYO_SERVER, name: 'c2-live-check' });
    createdId = created.json?.id ?? created.json?._id ?? null;
    check(created.status < 300 && !!createdId, 'Owner: create saves the custom MCP', `HTTP ${created.status}`);
    const list = await call(owner, 'GET', `${CONN}/custom-mcp`);
    check(list.status === 200 && JSON.stringify(list.json).includes(createdId ?? '\u0000'), 'Owner: GET /custom-mcp lists it');
    check(
      !/encrypted|"credential"\s*:\s*"[^"]/i.test(JSON.stringify(list.json)),
      'the list view carries no secret fields',
    );

    const mDiscover = await call(member, 'POST', `${CONN}/custom-mcp/discover`, BYO_SERVER);
    check(mDiscover.status === 403, 'Member: discover → 403', `HTTP ${mDiscover.status}`);
    const mCreate = await call(member, 'POST', `${CONN}/custom-mcp`, { ...BYO_SERVER, name: 'must-not-exist' });
    check(mCreate.status === 403, 'Member: create → 403', `HTTP ${mCreate.status}`);

    const patch = await call(owner, 'PATCH', `${AUTH}/admin/workspace`, { connectorAllowList: ['calendar'] });
    check(patch.status < 300, 'Owner: narrow the allow-list to [calendar]', `HTTP ${patch.status}`);
    // The workspace is read per request but give the change a moment to be visible.
    let blocked = null;
    for (let i = 0; i < 8; i++) {
      blocked = await call(member, 'GET', `${CONN}/oauth/gmail/start`);
      if (blocked.status === 403) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    check(
      blocked.status === 403 && blocked.json?.code === 'CONNECTOR_NOT_ALLOWED',
      'Member: gmail connect refused (not in the allow-list)',
      `HTTP ${blocked.status} ${blocked.json?.code ?? ''}`,
    );
    const notion = await call(member, 'GET', `${CONN}/oauth/notion/start`);
    check(notion.status === 403, 'Member: notion connect refused (not in the allow-list)', `HTTP ${notion.status}`);
    const calendar = await call(member, 'GET', `${CONN}/oauth/calendar/start`);
    check(
      calendar.status === 200 || calendar.json?.code === 'CONNECTOR_NOT_CONFIGURED',
      'Member: calendar (allow-listed) is still allowed to start',
      `HTTP ${calendar.status}`,
    );
  } finally {
    await call(owner, 'PATCH', `${AUTH}/admin/workspace`, { connectorAllowList: original });
    const back = await call(owner, 'GET', `${AUTH}/admin/workspace`);
    check(
      JSON.stringify(back.json.connectorAllowList) === JSON.stringify(original),
      'cleanup: allow-list restored exactly',
      JSON.stringify(back.json.connectorAllowList),
    );
    if (createdId) {
      const del = await call(owner, 'DELETE', `${CONN}/custom-mcp/${createdId}`);
      const after = await call(owner, 'GET', `${CONN}/custom-mcp`);
      check(
        del.status < 300 && !JSON.stringify(after.json).includes(createdId),
        'cleanup: the test custom MCP is deleted',
        `HTTP ${del.status}`,
      );
    }
  }
}

(async () => {
  const owner = (await lib.login('dev@pon.local')).token;
  const member = (await lib.login('alice@pon.local')).token;
  await checkAuthorizeUrls(owner);
  await checkCustomMcpAndAllowList(owner, member);
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await lib.disconnect().catch(() => {});
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR:', e.message);
  process.exit(2);
});
