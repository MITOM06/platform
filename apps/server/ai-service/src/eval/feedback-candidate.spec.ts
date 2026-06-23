import { buildFeedbackCandidate } from './feedback-candidate';

describe('buildFeedbackCandidate', () => {
  it('uses the user comment in the rubric when present', () => {
    const c = buildFeedbackCandidate({
      messageId: 'm1',
      question: 'What is our refund policy?',
      answer: 'It is 30 days.',
      comment: 'wrong, it is 14 days',
    });
    expect(c.id).toBe('fb-m1');
    expect(c.category).toBe('feedback');
    expect(c.prompt).toBe('What is our refund policy?');
    expect(c.rubric).toContain('14 days');
    expect(c._source.messageId).toBe('m1');
  });

  it('falls back to a generic rubric without a comment', () => {
    const c = buildFeedbackCandidate({ messageId: 'm2', question: 'Hi', answer: 'Hello' });
    expect(c.rubric).toContain('directly address the user prompt');
  });

  it('flags a missing original prompt for review', () => {
    const c = buildFeedbackCandidate({ messageId: 'm3', question: '', answer: 'x' });
    expect(c.prompt).toContain('review needed');
  });

  it('truncates the answer preview to 200 chars', () => {
    const c = buildFeedbackCandidate({ messageId: 'm4', question: 'q', answer: 'a'.repeat(500) });
    expect(c._source.answerPreview.length).toBe(200);
  });
});
