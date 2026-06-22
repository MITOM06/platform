import { redactPii, redactAll, REDACT_ALL, REDACT_SECRETS_ONLY } from './pii-redactor';

describe('redactPii', () => {
  describe('emails', () => {
    it('masks an email but keeps first char + TLD', () => {
      expect(redactPii('contact me at john.doe@example.com please')).toBe(
        'contact me at j***@***.com please',
      );
    });

    it('keeps emails when email flag is off (memory mode)', () => {
      expect(redactPii('john@example.com', REDACT_SECRETS_ONLY)).toBe('john@example.com');
    });
  });

  describe('secrets', () => {
    it('redacts an Anthropic-style key', () => {
      expect(redactPii('key is sk-ant-abc123XYZ_def456 ok')).toBe('key is [REDACTED] ok');
    });

    it('redacts a GitHub token', () => {
      expect(redactPii('ghp_aBcD1234efGh5678ijKl')).toBe('[REDACTED]');
    });

    it('redacts an AWS access key id', () => {
      expect(redactPii('AKIAIOSFODNN7EXAMPLE')).toBe('[REDACTED]');
    });

    it('redacts a bearer token', () => {
      expect(redactPii('Authorization: Bearer abcdef0123456789xyz')).toContain('[REDACTED]');
    });

    it('redacts secrets even in memory mode', () => {
      expect(redactPii('sk-ant-abc123XYZ_def456', REDACT_SECRETS_ONLY)).toBe('[REDACTED]');
    });
  });

  describe('numeric (phone / card)', () => {
    it('redacts a phone number', () => {
      expect(redactPii('call +1 (415) 555-2671 now')).toBe('call [REDACTED] now');
    });

    it('redacts a 16-digit card number', () => {
      expect(redactPii('card 4111 1111 1111 1111')).toBe('card [REDACTED]');
    });

    it('does NOT redact a short number', () => {
      expect(redactPii('chunk size is 512 tokens')).toBe('chunk size is 512 tokens');
    });

    it('does NOT redact a date (≤8 digits)', () => {
      expect(redactPii('released on 2026-06-22')).toBe('released on 2026-06-22');
    });

    it('keeps phones in memory mode but still drops cards', () => {
      expect(redactPii('phone 4155552671', REDACT_SECRETS_ONLY)).toBe('phone 4155552671');
      expect(redactPii('card 4111111111111111', REDACT_SECRETS_ONLY)).toBe('card [REDACTED]');
    });
  });

  it('handles empty / falsy input', () => {
    expect(redactPii('')).toBe('');
  });

  it('redacts multiple PII types in one pass', () => {
    const out = redactPii('mail a@b.com tel 4155552671 key sk-ant-abcdefgh1234', REDACT_ALL);
    expect(out).toBe('mail a***@***.com tel [REDACTED] key [REDACTED]');
  });
});

describe('redactAll', () => {
  it('redacts each string in an array', () => {
    expect(redactAll(['email x@y.com', 'safe text'])).toEqual(['email x***@***.com', 'safe text']);
  });
});
