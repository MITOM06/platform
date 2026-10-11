import { DigestGeneratorService } from './digest-generator.service';

/**
 * QC 2026-10-11: with a workspace on the "mid" tier and ANTHROPIC_MID_MODEL set
 * to an OpenRouter id (the Mac mini default, `nvidia/…:free`), the digest sent
 * that id to the Anthropic client → 404, swallowed → the digest never arrived.
 */
describe('DigestGeneratorService model call', () => {
  const reply = { content: [{ type: 'text', text: 'Recap' }], usage: {} };
  const config = (values: Record<string, string>) =>
    ({ get: (k: string) => values[k] }) as never;
  const midOnOpenRouter = {
    'config.anthropic.router.simpleModel': 'claude-haiku-4-5',
    'config.anthropic.router.midModel': 'nvidia/nemotron:free',
  };

  function build(llm: Record<string, unknown> | undefined, values = midOnOpenRouter) {
    const svc = new DigestGeneratorService(
      {} as never,
      {} as never,
      config(values),
      undefined,
      llm as never,
    );
    const anthropic = { messages: { create: jest.fn().mockResolvedValue(reply) } };
    (svc as any).anthropic = anthropic;
    return { svc, anthropic };
  }

  it('an OpenRouter tier model never reaches the Anthropic client while OpenRouter is off', async () => {
    const { svc, anthropic } = build({
      openRouterEnabled: false,
      claudeFallbackModel: 'claude-haiku-4-5',
      createLight: jest.fn(),
      clientFor: jest.fn(),
    });

    await expect((svc as any).summarize('A: hi', { modelTier: 'mid' })).resolves.toBe('Recap');

    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('with OpenRouter on, the OpenRouter tier model goes to the OpenRouter client', async () => {
    const openRouterCreate = jest.fn().mockResolvedValue(reply);
    const { svc, anthropic } = build({
      openRouterEnabled: true,
      claudeFallbackModel: 'claude-haiku-4-5',
      createLight: jest.fn(),
      clientFor: jest.fn(() => ({ messages: { create: openRouterCreate } })),
    });

    await expect((svc as any).summarize('A: hi', { modelTier: 'mid' })).resolves.toBe('Recap');

    expect(openRouterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'nvidia/nemotron:free' }),
    );
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('an OpenRouter failure falls back to Claude instead of dropping the digest', async () => {
    const { svc, anthropic } = build({
      openRouterEnabled: true,
      claudeFallbackModel: 'claude-haiku-4-5',
      createLight: jest.fn(),
      clientFor: jest.fn(() => ({
        messages: { create: jest.fn().mockRejectedValue(new Error('503')) },
      })),
    });

    await expect((svc as any).summarize('A: hi', { modelTier: 'mid' })).resolves.toBe('Recap');
    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('an empty OpenRouter answer falls back to Claude instead of an empty digest', async () => {
    const { svc, anthropic } = build({
      openRouterEnabled: true,
      claudeFallbackModel: 'claude-haiku-4-5',
      createLight: jest.fn(),
      clientFor: jest.fn(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({ content: [], stop_reason: 'max_tokens', usage: {} }),
        },
      })),
    });

    await expect((svc as any).summarize('A: hi', { modelTier: 'mid' })).resolves.toBe('Recap');
    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('a Claude tier model still goes straight to Anthropic', async () => {
    const { svc, anthropic } = build(undefined, {
      ...midOnOpenRouter,
      'config.anthropic.router.midModel': 'claude-sonnet-4-6',
    });

    await (svc as any).summarize('A: hi', { modelTier: 'mid' });

    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    );
  });
});
