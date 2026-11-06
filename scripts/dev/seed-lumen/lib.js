// Module resolution that works both from the repo (Air) and inside the
// ai-service image (/app/seed-lumen next to /app/node_modules).
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../..');

function mod(name) {
  try {
    return require(name);
  } catch {
    return require(path.join(ROOT, 'node_modules', name));
  }
}

// The story's "today". Every scripted message, file and meeting note talks
// about concrete dates (go-live Wed 28/10, BGĐ Fri 23/10, Q3 results …), so the
// whole story is pinned to Monday 26/10/2026 17:30 (UTC+7) instead of the
// moment the seed runs — otherwise "go-live is tomorrow" shows up weeks after
// go-live. Override with SEED_NOW=<ISO date> to replay it at another moment.
// Things that only make sense relative to the real clock (upcoming meetings,
// open reminders, token-usage meter) use REAL_NOW instead.
const STORY_NOW = Date.parse(process.env.SEED_NOW || '2026-10-26T10:30:00Z');
// SEED_REAL_NOW=<ISO> pretends the seed runs at another moment — local testing only
// (on a real server it would create meetings/messages dated in the future).
const REAL_NOW = process.env.SEED_REAL_NOW ? Date.parse(process.env.SEED_REAL_NOW) : Date.now();

// Deterministic PRNG (mulberry32) so a re-seed produces the same company.
function rng(seedText) {
  let h = 1779033703;
  for (const ch of String(seedText)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

// 'YYYY-MM-DDTHH:mm' in ICT (UTC+7) → epoch ms (November chapter, demo day).
const ictTime = (at) => Date.parse(`${at}:00+07:00`);

module.exports = { mod, ROOT, STORY_NOW, REAL_NOW, rng, ictTime };
