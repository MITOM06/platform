import { AiSessionService } from './ai-session.service';
import { ClaudeClientService } from './claude-client.service';

function make() {
  const model = {
    findOne: jest.fn(),
    create: jest.fn((doc: unknown) => Promise.resolve(doc)),
    updateOne: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
    findById: jest.fn(),
    find: jest.fn(),
  };
  const claude = { generateTitle: jest.fn().mockResolvedValue('Trip planning') };
  const svc = new AiSessionService(model as never, claude as never);
  return { svc, model, claude };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('AiSessionService', () => {
  it('returns the active session when one exists', async () => {
    const { svc, model } = make();
    model.findOne.mockResolvedValue({ _id: 's1' });
    await expect(svc.getOrCreateActiveSession('u1', 'c1')).resolves.toEqual({ _id: 's1' });
    expect(model.findOne).toHaveBeenCalledWith({ userId: 'u1', conversationId: 'c1', isActive: true });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates an empty active session when none exists', async () => {
    const { svc, model } = make();
    model.findOne.mockResolvedValue(null);
    await svc.getOrCreateActiveSession('u1', 'c1');
    expect(model.create).toHaveBeenCalledWith({
      userId: 'u1',
      conversationId: 'c1',
      name: 'New conversation',
      messages: [],
      isActive: true,
      totalTokens: 0,
    });
  });

  describe('appendMessage', () => {
    function selectReturning(doc: unknown) {
      return { select: jest.fn().mockResolvedValue(doc) };
    }

    it('pushes the message and adds ceil(chars/4) tokens', async () => {
      const { svc, model } = make();
      model.findById.mockReturnValue(selectReturning(null));
      await svc.appendMessage('s1', 'user', 'hello');
      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: 's1' },
        {
          $push: { messages: { role: 'user', content: 'hello', createdAt: expect.any(Date) } },
          $inc: { totalTokens: 2 },
        },
      );
    });

    it('auto-names the session from the first message, attributing usage to its owner', async () => {
      const { svc, model, claude } = make();
      model.findById.mockReturnValue(
        selectReturning({ _id: 's1', userId: 'u1', name: 'New conversation', messages: [{ content: 'plan a trip' }] }),
      );
      await svc.appendMessage('s1', 'user', 'plan a trip');
      await flush();
      expect(claude.generateTitle).toHaveBeenCalledWith('plan a trip', 'u1');
      expect(model.updateOne).toHaveBeenLastCalledWith({ _id: 's1' }, { $set: { name: 'Trip planning' } });
    });

    it('does not rename an already-named or multi-message session', async () => {
      const { svc, model, claude } = make();
      model.findById
        .mockReturnValueOnce(selectReturning({ name: 'Custom', messages: [{ content: 'a' }] }))
        .mockReturnValueOnce(selectReturning({ name: 'New conversation', messages: [{}, {}] }));
      await svc.appendMessage('s1', 'user', 'a');
      await svc.appendMessage('s1', 'assistant', 'b');
      await flush();
      expect(claude.generateTitle).not.toHaveBeenCalled();
    });

    it('a failing title generation never rejects the append', async () => {
      const { svc, model, claude } = make();
      claude.generateTitle.mockRejectedValue(new Error('quota'));
      model.findById.mockReturnValue(
        selectReturning({ _id: 's1', userId: 'u1', name: 'New conversation', messages: [{ content: 'x' }] }),
      );
      await expect(svc.appendMessage('s1', 'user', 'x')).resolves.toBeUndefined();
      await flush();
      expect(model.updateOne).toHaveBeenCalledTimes(1);
    });
  });

  it('createNewSession deactivates only the caller’s active sessions in that conversation', async () => {
    const { svc, model } = make();
    await svc.createNewSession('u1', 'c1');
    expect(model.updateMany).toHaveBeenCalledWith(
      { userId: 'u1', conversationId: 'c1', isActive: true },
      { $set: { isActive: false } },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', isActive: true }));
  });

  describe('resumeSession — ownership', () => {
    it('returns null and changes nothing for a session not owned by the caller', async () => {
      const { svc, model } = make();
      model.findOne.mockResolvedValue(null);
      await expect(svc.resumeSession('s9', 'u1', 'c1')).resolves.toBeNull();
      expect(model.findOne).toHaveBeenCalledWith({ _id: 's9', userId: 'u1', conversationId: 'c1' });
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('deactivates the current session and activates the target', async () => {
      const { svc, model } = make();
      const target = { isActive: false, save: jest.fn().mockResolvedValue(undefined) };
      model.findOne.mockResolvedValue(target);
      await expect(svc.resumeSession('s2', 'u1', 'c1')).resolves.toBe(target);
      expect(model.updateMany).toHaveBeenCalledWith(
        { userId: 'u1', conversationId: 'c1', isActive: true },
        { $set: { isActive: false } },
      );
      expect(target.isActive).toBe(true);
      expect(target.save).toHaveBeenCalled();
    });
  });

  it('listSessions queries only the caller’s sessions, active first, capped at 50', async () => {
    const { svc, model } = make();
    const limit = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ select });
    model.find.mockReturnValue({ sort });
    await svc.listSessions('u1', 'c1');
    expect(model.find).toHaveBeenCalledWith({ userId: 'u1', conversationId: 'c1' });
    expect(sort).toHaveBeenCalledWith({ isActive: -1, updatedAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  describe('renameSession', () => {
    it('returns null for a session the caller does not own', async () => {
      const { svc, model } = make();
      model.findOne.mockResolvedValue(null);
      await expect(svc.renameSession('s1', 'u2', 'x')).resolves.toBeNull();
      expect(model.findOne).toHaveBeenCalledWith({ _id: 's1', userId: 'u2' });
    });

    it('trims and caps the name at 80 chars; blank falls back to the default', async () => {
      const { svc, model } = make();
      const doc = { name: '', save: jest.fn().mockResolvedValue(undefined) };
      model.findOne.mockResolvedValue(doc);
      await svc.renameSession('s1', 'u1', `  ${'a'.repeat(100)}  `);
      expect(doc.name).toBe('a'.repeat(80));
      await svc.renameSession('s1', 'u1', '   ');
      expect(doc.name).toBe('New conversation');
      await svc.renameSession('s1', 'u1', undefined as unknown as string);
      expect(doc.name).toBe('New conversation');
    });
  });

  describe('buildMessageHistory', () => {
    const msgs = (roles: Array<'user' | 'assistant'>) =>
      roles.map((role, i) => ({ role, content: `m${i}` }));

    it('returns every turn when uncapped', async () => {
      const { svc } = make();
      const out = await svc.buildMessageHistory({ messages: msgs(['user', 'assistant']) } as never);
      expect(out).toEqual([
        { role: 'user', content: 'm0' },
        { role: 'assistant', content: 'm1' },
      ]);
    });

    it('opens the window on a user turn, skipping an orphaned assistant reply', async () => {
      const { svc } = make();
      const out = await svc.buildMessageHistory(
        { messages: msgs(['user', 'assistant', 'user', 'assistant', 'user']) } as never,
        4,
      );
      expect(out.map((m) => m.content)).toEqual(['m2', 'm3', 'm4']);
    });

    it('prepends the compaction summary as a synthetic exchange', async () => {
      const { svc } = make();
      const out = await svc.buildMessageHistory(
        { messages: msgs(['user']), summary: 'we agreed X' } as never,
      );
      expect(out).toEqual([
        { role: 'user', content: '[Context from earlier conversation]\nwe agreed X' },
        { role: 'assistant', content: 'Understood. I have the context from our earlier conversation.' },
        { role: 'user', content: 'm0' },
      ]);
    });
  });
});

describe('ClaudeClientService', () => {
  function makeClient(opts: { text?: string; contentType?: string; llm?: boolean } = {}) {
    const message = {
      content: [{ type: opts.contentType ?? 'text', text: opts.text ?? 'A title' }],
      usage: { input_tokens: 1, output_tokens: 2 },
    };
    const usage = { recordModelCall: jest.fn() };
    const llm = { createLight: jest.fn().mockResolvedValue({ message }) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const svc = new ClaudeClientService(config as never, usage as never, opts.llm === false ? undefined : (llm as never));
    const anthropicCreate = jest.fn().mockResolvedValue(message);
    (svc as unknown as { anthropic: unknown }).anthropic = { messages: { create: anthropicCreate } };
    return { svc, usage, llm, anthropicCreate, message };
  }

  it('generateTitle skips the model for a blank message', async () => {
    const { svc, llm } = makeClient();
    await expect(svc.generateTitle('   ')).resolves.toBe('New conversation');
    expect(llm.createLight).not.toHaveBeenCalled();
  });

  it('generateTitle strips quotes, records usage against the user and caps at 80', async () => {
    const { svc, usage, llm, message } = makeClient({ text: ` "${'T'.repeat(90)}" ` });
    const title = await svc.generateTitle('hello', 'u1');
    expect(title).toBe('T'.repeat(80));
    expect(usage.recordModelCall).toHaveBeenCalledWith('u1', message.usage, 'session-title');
    expect(llm.createLight.mock.calls[0][0].max_tokens).toBe(32);
  });

  it('generateTitle falls back to the default for a non-text reply', async () => {
    const { svc } = makeClient({ contentType: 'tool_use' });
    await expect(svc.generateTitle('hello')).resolves.toBe('New conversation');
  });

  it('generateTitle truncates the prompt input to 2000 chars', async () => {
    const { svc, llm } = makeClient();
    await svc.generateTitle('x'.repeat(5000));
    const content = llm.createLight.mock.calls[0][0].messages[0].content as string;
    expect(content.endsWith('x'.repeat(2000))).toBe(true);
    expect(content).not.toContain('x'.repeat(2001));
  });

  it('summarize records compaction usage and returns the text (empty for non-text)', async () => {
    const { svc, usage, message } = makeClient({ text: 'summary' });
    await expect(svc.summarize('conv', 'u1')).resolves.toBe('summary');
    expect(usage.recordModelCall).toHaveBeenCalledWith('u1', message.usage, 'compaction');
    const nonText = makeClient({ contentType: 'tool_use' });
    await expect(nonText.svc.summarize('conv')).resolves.toBe('');
  });

  it('uses the Haiku fallback model directly when no light-LLM router is wired', async () => {
    const { svc, anthropicCreate } = makeClient({ llm: false });
    await svc.summarize('conv');
    expect(anthropicCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
  });
});
