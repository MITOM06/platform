import { AiDigestLogSchema } from '../ai-digest-log.schema';

describe('AiDigestLog schema (TASK-11)', () => {
  it('declares a UNIQUE compound index on {conversationId, digestDate} for idempotency', () => {
    const indexes = AiDigestLogSchema.indexes();
    const unique = indexes.find(
      ([fields, opts]) =>
        fields.conversationId === 1 &&
        fields.digestDate === 1 &&
        (opts as { unique?: boolean } | undefined)?.unique === true,
    );
    expect(unique).toBeDefined();
  });

  it('maps to the ai_digest_log collection', () => {
    expect(AiDigestLogSchema.get('collection')).toBe('ai_digest_log');
  });

  it('requires conversationId and digestDate', () => {
    const path = AiDigestLogSchema.path('conversationId');
    const datePath = AiDigestLogSchema.path('digestDate');
    expect(path.isRequired).toBe(true);
    expect(datePath.isRequired).toBe(true);
  });
});
