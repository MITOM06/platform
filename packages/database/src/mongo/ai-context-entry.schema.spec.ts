import { AiContextEntrySchema } from './ai-context-entry.schema';

describe('AiContextEntrySchema', () => {
  it('binds to the ai_context_entries collection with timestamps', () => {
    expect(AiContextEntrySchema.get('collection')).toBe('ai_context_entries');
    expect(AiContextEntrySchema.get('timestamps')).toBe(true);
  });

  it('defaults requiredCapability and scopeId to null', () => {
    const paths = AiContextEntrySchema.paths;
    expect(paths['requiredCapability'].options.default).toBeNull();
    expect(paths['scopeId'].options.default).toBeNull();
  });
});
