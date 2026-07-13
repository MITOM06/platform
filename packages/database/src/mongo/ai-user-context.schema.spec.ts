import { AiUserContextSchema } from './ai-user-context.schema';

describe('AiUserContextSchema', () => {
  it('binds to ai_user_context and makes userId unique', () => {
    expect(AiUserContextSchema.get('collection')).toBe('ai_user_context');
    expect(AiUserContextSchema.paths['userId'].options.unique).toBe(true);
  });

  it('defaults projects to an empty array', () => {
    expect(AiUserContextSchema.paths['projects'].options.default).toEqual([]);
  });
});
