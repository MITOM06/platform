// Render every PNG (avatars + images) on a machine that has fonts and write
// them to ./prebuilt/. The ai-service image has no fontconfig, so text there
// renders as boxes; index.js prefers these files when they exist.
//
//   node scripts/dev/seed-lumen/prebuild.js

const fs = require('node:fs');
const path = require('node:path');
const { renderAll } = require('./files');
const org = require('./org');

(async () => {
  const dir = path.join(__dirname, 'prebuilt');
  fs.mkdirSync(dir, { recursive: true });
  const out = await renderAll(org.PEOPLE);
  for (const [name, buf] of Object.entries(out)) fs.writeFileSync(path.join(dir, `${name}.png`), buf);
  console.log(`prebuilt ${Object.keys(out).length} PNGs → ${dir}`);
})().catch((e) => { console.error(e); process.exit(1); });
