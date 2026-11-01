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

module.exports = { mod, ROOT };
