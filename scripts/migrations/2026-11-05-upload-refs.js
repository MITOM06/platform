/**
 * Migration — backfill `metadata.refs` (and legacy `metadata.uploadedBy`) on existing GridFS uploads.
 *
 * Why: chat-service now authorizes `GET /api/uploads/{id}` per file (UploadAccessPolicy): the
 * uploader (`metadata.uploadedBy`), a participant of a conversation the file is attached to
 * (`metadata.refs` has {t:"c", id}), a member of the department whose KB holds it ({t:"d", id}),
 * or anyone logged in for a public profile image. New saves record refs automatically
 * (UploadRefs), but every file uploaded BEFORE that code has no refs — once UPLOADS_REQUIRE_AUTH
 * is on, such files would be readable only by their uploader (or by nobody, for legacy files
 * without `uploadedBy`). This script reconstructs the refs from history:
 *
 *   messages                    every /api/uploads/<id> in `content` -> {t:"c", id: conversationId}
 *                               (user, AI, reminder, system — no actor filter for history)
 *   conversations               avatarUrl, wallpaper                 -> {t:"c", id: conversation _id}
 *   ai_personas                 avatarUrl                            -> {t:"c", id: persona.conversationId}
 *   kb_documents                fileUrl -> {t:"c", id: conversationId} if set, else {t:"d", id: departmentId}
 *   users (attribution)         avatarUrl / coverPhoto of a legacy file with NO `metadata.uploadedBy`
 *                               -> uploadedBy = that user's _id (hex string), ONLY when exactly one
 *                               user references the file; ambiguous ones are listed, not touched.
 *
 * Ids are extracted exactly like UploadRefs.extractIds (UUID or 24-hex, lowercased, JSON `\/`
 * unescaped, `#fragment` / `?query` ignored) and files are matched like GET /api/uploads/{id}:
 * a UUID by `metadata.fileId`; a 24-hex id only as a LEGACY file (`_id`, no `metadata.fileId`).
 *
 * Never changes an existing `uploadedBy`. Never removes a ref. Idempotent: refs go in with
 * $addToSet and already-present ones are skipped, so a second run reports 0 changes.
 * Re-run is also the way to sweep up messages saved between the backup and the flag flip.
 *
 * Messages are streamed with a cursor (filtered on `content` containing the uploads path; that
 * filter is a collection scan — run off-peak on a big DB) and written in batched bulkWrites.
 *
 * RUN IT AFTER THE 1b CODE (UploadRefs / UploadAccessPolicy) IS DEPLOYED and BEFORE setting
 * UPLOADS_REQUIRE_AUTH=true. TAKE A BACKUP FIRST (this writes to `fs.files`).
 * Afterwards check the report: "no ref, no uploadedBy" files become unreadable (except public
 * workspace/bot images, which are not counted separately here) once the flag is on.
 *
 * Usage:
 *   mongosh "$MONGODB_URI" scripts/migrations/2026-11-05-upload-refs.js
 *   pnpm migrate:upload-refs                       # same, uses $MONGODB_URI
 *   # dry run (identical report, writes nothing):
 *   mongosh "$MONGODB_URI" --eval 'var DRY_RUN=true' scripts/migrations/2026-11-05-upload-refs.js
 *   DRY_RUN=1 pnpm migrate:upload-refs
 *   # local: mongosh "mongodb://localhost:27018/platform" scripts/migrations/...
 */
const DRY = (typeof DRY_RUN !== 'undefined' && !!DRY_RUN) || (typeof process !== 'undefined' && !!process.env.DRY_RUN);
const BATCH = 500;
const FILES = db.getCollection('fs.files');

const UPLOAD_URL =
  /\/api\/uploads\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{24})(?![0-9a-zA-Z_-])/g;

function extractIds(text) {
  const ids = new Set();
  if (typeof text !== 'string' || !text) return ids;
  const s = text.split('\\/').join('/');
  let m;
  UPLOAD_URL.lastIndex = 0;
  while ((m = UPLOAD_URL.exec(s)) !== null) ids.add(m[1].toLowerCase());
  return ids;
}

const hex = (id) => (id && id.toHexString ? id.toHexString() : String(id));
const blank = (v) => v === undefined || v === null || v === '';

// Resolve public upload ids -> { fileHexId: { _id, refs:Set, uploadedBy } }
function resolveFiles(idSet) {
  const uuids = [];
  const legacy = [];
  idSet.forEach((id) => {
    if (id.length === 24) legacy.push(ObjectId(id));
    else uuids.push(id);
  });
  const or = [];
  if (uuids.length) or.push({ 'metadata.fileId': { $in: uuids } });
  if (legacy.length) or.push({ _id: { $in: legacy }, 'metadata.fileId': { $exists: false } });
  const byPublicId = {};
  if (!or.length) return byPublicId;
  FILES.find({ $or: or }, { 'metadata.fileId': 1, 'metadata.refs': 1, 'metadata.uploadedBy': 1 }).forEach((f) => {
    const md = f.metadata || {};
    const pub = md.fileId ? String(md.fileId).toLowerCase() : hex(f._id);
    const refs = new Set((md.refs || []).map((r) => r.t + ':' + r.id));
    byPublicId[pub] = { _id: f._id, refs, uploadedBy: md.uploadedBy };
  });
  return byPublicId;
}

// ---- report state ----
const SOURCES = ['messages', 'conversations', 'personas', 'kb'];
const refsAdded = {};
const filesTouched = {};
SOURCES.forEach((s) => {
  refsAdded[s] = 0;
  filesTouched[s] = new Set();
});
const applied = new Set(); // "<fileHex>|<t>:<id>" already added in this run
const gainedRef = new Set(); // file hex ids that got >=1 new ref (needed for the dry-run report)
const gainedUploader = new Set();
let pending = []; // { src, ids:Set, t, id }
let ops = [];

function flushOps() {
  if (ops.length && !DRY) FILES.bulkWrite(ops, { ordered: false });
  ops = [];
}

function addRefs(src, text, t, id) {
  if (blank(id)) return;
  const ids = extractIds(text);
  if (!ids.size) return;
  pending.push({ src, ids, t, id: String(id) });
  if (pending.length >= BATCH) flushPending();
}

function flushPending() {
  if (!pending.length) return;
  const all = new Set();
  pending.forEach((p) => p.ids.forEach((i) => all.add(i)));
  const files = resolveFiles(all);
  pending.forEach((p) => {
    p.ids.forEach((pub) => {
      const f = files[pub];
      if (!f) return; // dangling link (file deleted / never uploaded)
      const key = p.t + ':' + p.id;
      const fh = hex(f._id);
      if (f.refs.has(key) || applied.has(fh + '|' + key)) return;
      applied.add(fh + '|' + key);
      gainedRef.add(fh);
      refsAdded[p.src] += 1;
      filesTouched[p.src].add(fh);
      ops.push({ updateOne: { filter: { _id: f._id }, update: { $addToSet: { 'metadata.refs': { t: p.t, id: p.id } } } } });
    });
  });
  pending = [];
  flushOps();
}

print(`[info] upload refs backfill ${DRY ? '(DRY RUN — nothing is written)' : '(WRITING)'} on db '${db.getName()}'`);

// 1. messages (streamed)
let msgScanned = 0;
db.getCollection('messages')
  .find({ content: /api\\?\/uploads\\?\// }, { conversationId: 1, content: 1 })
  .batchSize(1000)
  .forEach((m) => {
    msgScanned += 1;
    addRefs('messages', m.content, 'c', m.conversationId);
  });
flushPending();

// 2. conversations
db.getCollection('conversations')
  .find({ $or: [{ avatarUrl: { $exists: true, $ne: null } }, { wallpaper: { $exists: true, $ne: null } }] }, { avatarUrl: 1, wallpaper: 1 })
  .forEach((c) => {
    addRefs('conversations', c.avatarUrl, 'c', hex(c._id));
    addRefs('conversations', c.wallpaper, 'c', hex(c._id));
  });
flushPending();

// 3. ai_personas
db.getCollection('ai_personas')
  .find({ avatarUrl: { $exists: true, $ne: null } }, { avatarUrl: 1, conversationId: 1 })
  .forEach((p) => addRefs('personas', p.avatarUrl, 'c', p.conversationId));
flushPending();

// 4. kb_documents
db.getCollection('kb_documents')
  .find({ fileUrl: { $exists: true, $ne: null } }, { fileUrl: 1, conversationId: 1, departmentId: 1 })
  .forEach((d) => {
    if (!blank(d.conversationId)) addRefs('kb', d.fileUrl, 'c', d.conversationId);
    else addRefs('kb', d.fileUrl, 'd', d.departmentId);
  });
flushPending();

// 5. uploadedBy attribution from users' avatar / cover (legacy files without uploadedBy only)
const usersByFile = {}; // public id -> Set of user hex ids
db.getCollection('users')
  .find({ $or: [{ avatarUrl: { $exists: true, $ne: null } }, { coverPhoto: { $exists: true, $ne: null } }] }, { avatarUrl: 1, coverPhoto: 1 })
  .forEach((u) => {
    const ids = new Set([...extractIds(u.avatarUrl), ...extractIds(u.coverPhoto)]);
    ids.forEach((id) => {
      (usersByFile[id] = usersByFile[id] || new Set()).add(hex(u._id));
    });
  });
const userFiles = resolveFiles(new Set(Object.keys(usersByFile)));
let attributed = 0;
const ambiguous = [];
Object.keys(usersByFile).forEach((pub) => {
  const f = userFiles[pub];
  if (!f || !blank(f.uploadedBy)) return; // dangling, or already has an owner — never overwrite
  const owners = [...usersByFile[pub]];
  if (owners.length !== 1) {
    ambiguous.push(`${pub} <- users ${owners.join(', ')}`);
    return;
  }
  attributed += 1;
  gainedUploader.add(hex(f._id));
  ops.push({
    updateOne: {
      filter: { _id: f._id, $or: [{ 'metadata.uploadedBy': { $exists: false } }, { 'metadata.uploadedBy': null }, { 'metadata.uploadedBy': '' }] },
      update: { $set: { 'metadata.uploadedBy': owners[0] } },
    },
  });
});
flushOps();

// 6. final state (dry run folds in the changes it did not write)
let total = 0;
let noRefNoOwner = 0;
let ownerOnly = 0;
const orphanSample = [];
FILES.find({}, { 'metadata.refs': 1, 'metadata.uploadedBy': 1, 'metadata.fileId': 1, filename: 1 }).forEach((f) => {
  total += 1;
  const md = f.metadata || {};
  const fh = hex(f._id);
  const hasRef = (md.refs && md.refs.length > 0) || gainedRef.has(fh);
  const hasOwner = !blank(md.uploadedBy) || gainedUploader.has(fh);
  if (!hasRef && !hasOwner) {
    noRefNoOwner += 1;
    if (orphanSample.length < 10) orphanSample.push(md.fileId || fh);
  } else if (!hasRef && hasOwner) ownerOnly += 1;
});

print('');
print(`==== upload refs backfill report ${DRY ? '(DRY RUN)' : ''} ====`);
print(`messages scanned (with upload links): ${msgScanned}`);
SOURCES.forEach((s) =>
  print(`  ${s.padEnd(14)} refs added=${refsAdded[s]}  files gaining a ref=${filesTouched[s].size}`),
);
print(`files gaining >=1 ref (distinct): ${gainedRef.size}`);
print(`uploadedBy attributed from users avatar/cover: ${attributed}`);
print(`ambiguous avatar/cover files (shared by >1 user, NOT attributed): ${ambiguous.length}`);
ambiguous.forEach((a) => print('    ' + a));
print(`fs.files total: ${total}`);
print(`  with NO ref and NO uploadedBy (unreadable once flag is on): ${noRefNoOwner}`);
orphanSample.forEach((o) => print('    e.g. ' + o));
print(`  with uploadedBy only (uploader-only access): ${ownerOnly}`);
const changes = Object.values(refsAdded).reduce((a, b) => a + b, 0) + attributed;
print(`TOTAL CHANGES ${DRY ? 'that would be made' : 'made'}: ${changes}`);
