// Meetings (Phòng họp) for the Lumen seed: story meetings (meetings.js), the
// November chapter + demo day (meetings-nov.js) and the recurring ones.
//
// A meeting whose end is before the moment the seed RUNS is stored ENDED with
// attendance, shared notes, chat (incl. files dropped into it) and — when the
// AI note-taker was on — the full AI trail chat-service would have produced:
// transcript + file material records (meeting_records), the summary
// (meeting_summaries, summaryState DONE) and the "Họp: <title>" group chat
// holding the AI summary card. Later meetings stay SCHEDULED, so re-running the
// seed on demo morning turns everything that already "happened" into history.

const crypto = require('node:crypto');
const { mod, REAL_NOW, ictTime } = require('./lib');
const { ObjectId } = mod('mongodb');
const { MEETINGS, RECURRING, PRIVATE_NOTES } = require('./meetings');
const { MEETINGS_NOV, AI_FOR_EXISTING } = require('./meetings-nov');
const { MEETINGS_W46 } = require('./meetings-w46');
const { AI_BOT_ID } = require('./messages');

const TAG = 'lumen';
const MIN = 60000;
const tagged = (doc) => ({ ...doc, seedTag: TAG });
const GROUP_NAME_MAX = 100;
const FILE_TEXT_MAX = 6000;

function meetingCode() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const s = Array.from(crypto.randomBytes(10), (b) => letters[b % letters.length]).join('');
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
}

const settings = (aiNotes) => ({ waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true, attendeesCanEditNotes: true, locked: false, aiNotes: !!aiNotes });

// Story meetings use "minutes before STORY_NOW"; November ones an ICT timestamp.
function normalise(minsAgo) {
  const story = MEETINGS.map((m) => ({ ...m, ...(AI_FOR_EXISTING[m.key] || {}), aiNotes: !!AI_FOR_EXISTING[m.key], startDate: minsAgo(m.start) }));
  const nov = [...MEETINGS_NOV, ...MEETINGS_W46].map((m) => ({ ...m, startDate: new Date(ictTime(m.startAt)) }));
  return [...story, ...nov];
}

const groupName = (title) => {
  const name = `Họp: ${title.trim()}`;
  return [...name].length <= GROUP_NAME_MAX ? name : `${[...name].slice(0, GROUP_NAME_MAX - 1).join('')}…`;
};

async function seedMeetings(db, { ids, names, dept }, { files, urlFor, minsAgo }) {
  const uid = (k) => String(ids[k]);
  const known = (k) => !!ids[k];
  let count = 0;
  let summaries = 0;
  let records = 0;
  let groups = 0;
  const meetingIds = {};

  for (let m of normalise(minsAgo)) {
    m = { ...m, invitees: m.invitees.filter(known), cohosts: (m.cohosts || []).filter(known), attended: m.attended && m.attended.filter(known) };
    const start = m.startDate;
    const end = new Date(start.getTime() + m.duration * MIN);
    const ended = end.getTime() < REAL_NOW;
    if (ended && !m.attended) m = { ...m, attended: [m.host, ...m.invitees.filter((k) => k !== m.host)] };
    const id = new ObjectId();
    const meetingId = String(id);
    meetingIds[m.key] = meetingId;
    const roleOf = (k) => (k === m.host ? 'host' : m.cohosts.includes(k) ? 'cohost' : 'attendee');
    const attendance = ended ? m.attended.map((k, i) => ({
      userId: uid(k), displayName: names[k], role: roleOf(k), sid: `PA_${crypto.randomBytes(6).toString('hex')}`,
      joinedAt: new Date(start.getTime() + i * 45000), leftAt: new Date(end.getTime() - (i % 3) * 30000),
    })) : [];

    // Files dropped into the meeting chat (stored once in GridFS, reused by chat if shared there too).
    const shared = [];
    if (ended) {
      for (const f of m.files || []) {
        const file = files[f.file];
        if (!file || !known(f.by)) continue;
        const url = await urlFor(f.file, uid(f.by));
        shared.push({ ...f, file, url, uploadId: url.split('/').pop(), at: new Date(start.getTime() + f.atMin * MIN) });
      }
    }
    const ai = ended && m.aiNotes && m.summary;
    const attempt = ai ? crypto.randomUUID() : null;

    const doc = tagged({
      _id: id, code: meetingCode(), title: m.title, description: m.description,
      hostId: uid(m.host), coHostIds: m.cohosts.map(uid), inviteeIds: m.invitees.map(uid),
      departmentId: m.dept ? String(dept[m.dept]) : null,
      scheduledStart: start, scheduledEnd: end, sortAt: start, status: ended ? 'ENDED' : 'SCHEDULED',
      settings: settings(m.aiNotes), removedIds: [], attendance, reminded: ended,
      createdAt: new Date(start.getTime() - (ended ? 3 : 2) * 86400000),
      ...(ended ? { startedAt: new Date(start.getTime() + 30000), endedAt: end } : {}),
      aiNotesEverEnabled: !!(ended && m.aiNotes),
      ...(ai ? {
        summaryState: 'DONE', summaryAttempt: attempt, summaryRequestedAt: new Date(end.getTime() + 5000),
        aiFileCount: shared.length, aiFileUploadIds: shared.map((s) => s.uploadId),
      } : {}),
      _class: 'com.platform.chatservice.model.Meeting',
    });

    // The meeting's group chat with the AI summary card (what MeetingSummaryResultListener posts).
    if (ai) {
      const members = [...new Set([uid(m.host), ...m.cohosts.map(uid), ...m.invitees.map(uid), ...attendance.map((a) => a.userId)])];
      if (members.length >= 2) {
        const convId = new ObjectId();
        const createdAt = new Date(end.getTime() + 30000);
        const postedAt = new Date(end.getTime() + 45000);
        const attendeeNames = [...new Set(attendance.map((a) => a.displayName).filter(Boolean))];
        const card = { ...m.summary, meetingId, title: m.title, attendees: attendeeNames, durationSec: Math.round((end - start) / 1000) };
        const sys = { _id: new ObjectId(), conversationId: String(convId), senderId: 'system', content: 'system.group.created', type: 'system', readBy: members, reactions: [], recalled: false, deletedFor: [], mentions: [], createdAt, _class: 'com.platform.chatservice.model.Message' };
        const summaryMsg = { _id: new ObjectId(), conversationId: String(convId), senderId: AI_BOT_ID, content: JSON.stringify(card), type: 'meeting_summary', readBy: members, reactions: [], recalled: false, deletedFor: [], mentions: [], createdAt: postedAt, _class: 'com.platform.chatservice.model.Message' };
        await db.collection('conversations').insertOne(tagged({
          _id: convId, participants: members, type: 'group', name: groupName(m.title), admins: [uid(m.host)], createdBy: uid(m.host),
          meetingId, publicChannel: false, pinnedMessages: [], status: 'accepted', hiddenFor: [], archivedBy: [], blockedBy: [], pendingMembers: [], mutedUntil: {},
          lastMessage: { content: summaryMsg.content, senderId: AI_BOT_ID, createdAt: postedAt }, lastMessageAt: postedAt, createdAt, updatedAt: postedAt,
          _class: 'com.platform.chatservice.model.Conversation',
        }));
        await db.collection('messages').insertMany([tagged(sys), tagged(summaryMsg)]);
        doc.groupConversationId = String(convId);
        groups++;
      }
    }
    await db.collection('meetings').insertOne(doc);
    count++;
    if (!ended) continue;

    if (m.notes) {
      await db.collection('meeting_notes').insertOne(tagged({
        meetingId, scope: 'shared', ownerId: null, content: m.notes, version: 7,
        updatedBy: uid(m.host), updatedAt: new Date(end.getTime() - 120000),
        _class: 'com.platform.chatservice.model.MeetingNote',
      }));
    }
    for (const n of [...(m.privateNotes || []), ...PRIVATE_NOTES.filter((p) => p.meeting === m.key)]) {
      if (!known(n.owner)) continue;
      await db.collection('meeting_notes').insertOne(tagged({
        meetingId, scope: 'private', ownerId: uid(n.owner), content: n.content, version: 3,
        updatedBy: uid(n.owner), updatedAt: new Date(end.getTime() + 3600000),
        _class: 'com.platform.chatservice.model.MeetingNote',
      }));
    }

    const chat = [
      ...(m.chat || []).filter((l) => known(l.from)).map((l) => ({ senderId: uid(l.from), content: l.text, createdAt: new Date(start.getTime() + l.atMin * MIN) })),
      ...shared.map((s) => ({ senderId: uid(s.by), content: '', createdAt: s.at,
        attachment: { uploadId: s.uploadId, url: s.url, name: s.file.name, size: s.file.buf.length, contentType: s.file.mime } })),
    ].sort((a, b) => a.createdAt - b.createdAt);
    for (const line of chat) {
      await db.collection('meeting_messages').insertOne(tagged({
        meetingId, ...line, clientId: crypto.randomUUID(), _class: 'com.platform.chatservice.model.MeetingMessage',
      }));
    }

    if (!ai) continue;
    const recs = [];
    for (const [i, t] of (m.transcript || []).entries()) {
      if (!known(t.who)) continue;
      const ts = new Date(start.getTime() + t.atMin * MIN + (i % 6) * 7000);
      recs.push({ meetingId, kind: 'SPEECH', userId: uid(t.who), displayName: names[t.who], text: t.text, ts, createdAt: new Date(ts.getTime() + 1200) });
    }
    for (const s of shared) {
      if (s.file.image) {
        recs.push({ meetingId, kind: 'FILE', userId: uid(s.by), displayName: names[s.by], text: s.file.text, ref: s.uploadId, fileName: s.file.name, ts: s.at, createdAt: new Date(s.at.getTime() + 9000) });
      } else {
        recs.push({ meetingId, kind: 'FILE', userId: uid(s.by), displayName: names[s.by], text: (s.file.text || '').slice(0, FILE_TEXT_MAX), ref: s.uploadId, fileName: s.file.name, ts: s.at, createdAt: new Date(s.at.getTime() + 9000) });
      }
    }
    if (recs.length) await db.collection('meeting_records').insertMany(recs.map((r) => tagged({ ...r, _class: 'com.platform.chatservice.model.MeetingRecord' })));
    records += recs.length;
    await db.collection('meeting_summaries').insertOne(tagged({
      meetingId, attempt, status: 'DONE', summary: m.summary, createdAt: new Date(end.getTime() + 42000),
      _class: 'com.platform.chatservice.model.MeetingSummaryDoc',
    }));
    summaries++;
  }

  // Recurring meetings against the real clock: next occurrences of a weekday, from tomorrow.
  const ICT = 7 * 3600 * 1000;
  for (const r of RECURRING) {
    const [hh, mm] = r.at.split(':').map(Number);
    const local = new Date(REAL_NOW + ICT);
    let day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 86400000;
    for (let made = 0; made < r.count; day += 86400000) {
      if (new Date(day).getUTCDay() !== r.weekday) continue;
      const start = new Date(day + (hh * 60 + mm) * 60000 - ICT);
      const end = new Date(start.getTime() + r.duration * 60000);
      await db.collection('meetings').insertOne(tagged({
        code: meetingCode(), title: r.title, description: r.description,
        hostId: uid(r.host), coHostIds: r.cohosts.filter(known).map(uid),
        inviteeIds: r.invitees.filter(known).map(uid), departmentId: r.dept ? String(dept[r.dept]) : null,
        scheduledStart: start, scheduledEnd: end, sortAt: start, status: 'SCHEDULED',
        settings: settings(true), removedIds: [], attendance: [], reminded: false, createdAt: new Date(REAL_NOW - 3 * 86400000),
        aiNotesEverEnabled: false, _class: 'com.platform.chatservice.model.Meeting',
      }));
      made++;
      count++;
    }
  }
  return { count, summaries, records, groups, meetingIds };
}

module.exports = { seedMeetings };
