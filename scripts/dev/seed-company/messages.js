// Turns the conversation DSL (conversations.js) into `messages` documents in
// the exact shape chat-service's Message model persists.

const path = require('node:path');
const ROOT = path.resolve(__dirname, '../../..');
const { ObjectId } = require(path.join(ROOT, 'node_modules/mongodb'));

function aiTrace(t, content) {
  const outputTokens = Math.max(40, Math.round(content.length / 3));
  return {
    thinkingBlocks: [],
    toolCalls: t ? [{ toolName: t.tool, inputSummary: t.input, resultSummary: t.result }] : [],
    inputTokens: 1800 + content.length * 4,
    outputTokens,
    thinkingTokens: 0,
    processingMs: 1500 + outputTokens * 9,
    model: 'claude-haiku-4-5',
    iterationCount: t ? 1 : 0,
  };
}

/**
 * @returns {{ docs: object[], pinned: string[], kbFiles: object[] }}
 *   docs in chronological order (strictly increasing createdAt), the ids to put
 *   in conversation.pinnedMessages, and the KB files to register.
 */
async function buildMessages({ c, convId, participants, uid, files, urlFor, minsAgo }) {
  const docs = [];
  const pinned = [];
  const kbFiles = [];
  const byLabel = {};
  const unreadFrom = c.messages.length - (c.unread || 0);
  let ago = c.start;
  let prevTs = 0;

  for (const [i, m] of c.messages.entries()) {
    ago = m.ago ?? ago - (2 + (i % 4));
    // Same-minute messages (question + AI answer) still need a stable order.
    let createdAt = minsAgo(ago);
    if (createdAt.getTime() <= prevTs) createdAt = new Date(prevTs + 7000);
    prevTs = createdAt.getTime();

    const type = m.type || 'text';
    const senderId = uid(m.from);
    let content = m.text || '';
    if (type === 'file' || type === 'image') {
      const f = files[m.file];
      const url = await urlFor(m.file, senderId);
      // file → {url,name,size} JSON; image → bare URL (parseFileMeta / parseImageUrls).
      content = type === 'image' ? url : JSON.stringify({ url, name: f.name, size: f.buf.length });
      if (f.kb) kbFiles.push({ url, name: f.name, mime: f.mime, userId: senderId, createdAt });
    }

    const id = new ObjectId();
    const reply = m.reply ? byLabel[m.reply] : null;
    const doc = {
      _id: id,
      conversationId: convId,
      senderId,
      content: m.recalled ? '' : content,
      type,
      readBy: i < unreadFrom ? participants.filter((p) => p !== 'ai-bot-000000000000000000000001') : [senderId].filter((p) => p !== 'system'),
      ...(reply ? { replyToId: String(reply._id), replyPreview: { messageId: String(reply._id), senderId: reply.senderId, content: reply.content } } : {}),
      reactions: Object.entries(m.react || {}).flatMap(([emoji, who]) => who.map((k) => ({ userId: uid(k), emoji }))),
      recalled: !!m.recalled,
      deletedFor: [],
      ...(m.edited ? { editedAt: new Date(createdAt.getTime() + 4 * 60000) } : {}),
      mentions: (m.mention || []).map(uid),
      ...(type === 'ai' ? { trace: aiTrace(m.trace, content) } : {}),
      createdAt,
      _class: 'com.platform.chatservice.model.Message',
    };
    docs.push(doc);
    if (m.id) byLabel[m.id] = doc;
    if (m.pin) pinned.push(String(id));
  }
  return { docs, pinned, kbFiles };
}

module.exports = { buildMessages, aiTrace };
