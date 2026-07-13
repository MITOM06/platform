import { AiRequestPayload, RequestContext } from './ai.types';

describe('AI context payload/context types', () => {
  it('AiRequestPayload accepts optional RBAC claims and remains valid without them', () => {
    const legacy: AiRequestPayload = {
      conversationId: 'c1',
      userId: 'u1',
      displayName: 'Khang',
      content: 'hi',
      history: [],
    };
    const enriched: AiRequestPayload = {
      ...legacy,
      role: 'Manager',
      perms: ['VIEW_INTERNAL_CONTEXT'],
      departmentIds: ['d1'],
    };
    expect(legacy.perms).toBeUndefined();
    expect(enriched.perms).toEqual(['VIEW_INTERNAL_CONTEXT']);
    expect(enriched.departmentIds).toEqual(['d1']);
  });

  it('RequestContext carries resolved (non-optional) perms + departmentIds', () => {
    const ctx = { perms: [] as string[], departmentIds: [] as string[] } as Partial<RequestContext>;
    expect(ctx.perms).toEqual([]);
    expect(ctx.departmentIds).toEqual([]);
  });
});
