/**
 * Import 👎 feedback into eval CANDIDATE cases for human review.
 *
 * Reads `ai_feedback` (rating='down') from the shared Mongo db, finds the AI
 * answer and the user question it replied to, and writes candidate eval cases to
 * eval/feedback-candidates.jsonl. A human curates these into dataset.jsonl — we
 * never auto-grow the frozen dataset (keeps the CI gate stable).
 *
 * Usage: MONGODB_URI=mongodb://localhost:27018/platform pnpm run eval:import-feedback
 */

import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { buildFeedbackCandidate } from '../src/eval/feedback-candidate';

const AI_BOT_USER_ID = process.env.AI_BOT_USER_ID ?? 'ai-bot-000000000000000000000001';
const OUT_PATH = path.join(__dirname, 'feedback-candidates.jsonl');

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI (or MONGO_URI) is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('ERROR: no Mongo connection.');
    process.exit(1);
  }

  const feedback = await db
    .collection('ai_feedback')
    .find({ rating: 'down' })
    .toArray();
  console.log(`Found ${feedback.length} down-rated answer(s).`);

  const messages = db.collection('messages');
  const lines: string[] = [];

  for (const fb of feedback) {
    const messageId = String(fb['messageId'] ?? '');
    if (!messageId) continue;

    let aiMsg: Record<string, unknown> | null = null;
    try {
      aiMsg = await messages.findOne({ _id: new mongoose.Types.ObjectId(messageId) });
    } catch {
      aiMsg = null; // non-ObjectId id — skip lookup, still emit a review stub
    }

    const conversationId = String(fb['conversationId'] ?? aiMsg?.['conversationId'] ?? '');
    const answer = String(aiMsg?.['content'] ?? '');

    // The question = most recent non-AI message before the AI answer in the convo.
    let question = '';
    if (aiMsg && conversationId) {
      const prior = await messages
        .find({
          conversationId,
          senderId: { $ne: AI_BOT_USER_ID },
          createdAt: { $lt: aiMsg['createdAt'] },
        })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      question = String(prior[0]?.['content'] ?? '');
    }

    const candidate = buildFeedbackCandidate({
      messageId,
      question,
      answer,
      comment: typeof fb['comment'] === 'string' ? (fb['comment'] as string) : '',
    });
    lines.push(JSON.stringify(candidate));
  }

  fs.writeFileSync(OUT_PATH, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  console.log(`Wrote ${lines.length} candidate(s) to ${OUT_PATH}`);
  console.log('Review them, then curate the good ones into eval/dataset.jsonl.');

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
}
