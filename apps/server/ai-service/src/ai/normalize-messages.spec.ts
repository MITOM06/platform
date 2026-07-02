import Anthropic from '@anthropic-ai/sdk';
import { normalizeMessages } from './ai.service';

const user = (content: string): Anthropic.MessageParam => ({ role: 'user', content });
const assistant = (content: string): Anthropic.MessageParam => ({ role: 'assistant', content });

// An image (multimodal) turn — content is a block array, not a plain string.
const imageTurn = (caption?: string): Anthropic.MessageParam => ({
  role: 'user',
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    ...(caption ? [{ type: 'text' as const, text: caption }] : []),
  ],
});

describe('normalizeMessages', () => {
  it('drops leading assistant turn(s) so the array starts with user', () => {
    const out = normalizeMessages([assistant('primed'), user('hi')]);
    expect(out).toEqual([user('hi')]);
  });

  it('drops MULTIPLE leading assistant turns', () => {
    const out = normalizeMessages([assistant('a'), assistant('b'), user('hi')]);
    expect(out).toEqual([user('hi')]);
  });

  it('merges two consecutive user turns (orphan-user defense, bug #1)', () => {
    // Simulates a previously-persisted orphan `user` turn followed by the next
    // request's `user` turn.
    const out = normalizeMessages([user('orphan question'), user('new question')]);
    expect(out).toEqual([user('orphan question\n\nnew question')]);
  });

  it('merges two consecutive assistant turns (summary-priming defense, bug #2)', () => {
    // Synthetic priming assistant + a kept slice that starts with assistant.
    const out = normalizeMessages([
      user('[Context from earlier conversation]\nsummary'),
      assistant('Understood.'),
      assistant('kept assistant turn'),
      user('current'),
    ]);
    expect(out).toEqual([
      user('[Context from earlier conversation]\nsummary'),
      assistant('Understood.\n\nkept assistant turn'),
      user('current'),
    ]);
  });

  it('never emits two consecutive same-role turns for a mixed messy history', () => {
    const out = normalizeMessages([
      assistant('leading — dropped'),
      user('u1'),
      user('u2'),
      assistant('a1'),
      assistant('a2'),
      user('u3'),
    ]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].role).not.toBe(out[i - 1].role);
    }
    expect(out[0].role).toBe('user');
  });

  it('leaves an image (block-array) turn intact and never merges into it', () => {
    const img = imageTurn('invoice');
    const out = normalizeMessages([img, user('what is the total?')]);
    // Image turn preserved as a block array; NOT merged with the following user
    // string turn (would corrupt the multimodal content).
    expect(Array.isArray(out[0].content)).toBe(true);
    expect(out[0].content).toBe(img.content); // reference preserved, not mutated
    expect(out[1]).toEqual(user('what is the total?'));
  });

  it('does not mutate the input array or its message objects', () => {
    const input = [user('a'), user('b')];
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizeMessages(input);
    expect(input).toEqual(snapshot);
  });

  it('leaves an already-valid alternating array unchanged', () => {
    const input = [user('u1'), assistant('a1'), user('u2')];
    expect(normalizeMessages(input)).toEqual(input);
  });
});
