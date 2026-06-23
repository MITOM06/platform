/**
 * Builds a candidate eval case from a 👎 feedback signal. Pure + unit-tested so
 * the import script (eval/import-feedback.ts) stays a thin Mongo wrapper.
 *
 * Candidates are written to a REVIEW file, never auto-merged into the frozen
 * dataset — a human curates them so the CI gate (TASK-08) stays stable.
 */
export interface FeedbackCandidate {
  id: string;
  category: 'feedback';
  prompt: string;
  context: string;
  rubric: string;
  /** Provenance for the human reviewer; stripped before adding to dataset. */
  _source: { messageId: string; comment: string; answerPreview: string };
}

export interface FeedbackInput {
  messageId: string;
  /** The user question that the down-rated answer responded to. */
  question: string;
  /** The AI answer that got the 👎. */
  answer: string;
  /** Optional one-line reason the user gave. */
  comment?: string;
}

export function buildFeedbackCandidate(input: FeedbackInput): FeedbackCandidate {
  const question = (input.question ?? '').trim();
  const comment = (input.comment ?? '').trim();
  const answer = (input.answer ?? '').trim();

  const rubric = comment
    ? `The answer must address the user's complaint: "${comment}".`
    : 'The answer must be correct, relevant, and directly address the user prompt.';

  return {
    id: `fb-${input.messageId}`,
    category: 'feedback',
    prompt: question || '(original user prompt unavailable — review needed)',
    context: '',
    rubric,
    _source: {
      messageId: input.messageId,
      comment,
      answerPreview: answer.slice(0, 200),
    },
  };
}
