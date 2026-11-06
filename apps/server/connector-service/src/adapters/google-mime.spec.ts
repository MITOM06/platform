import {
  buildMimeMessage,
  encodeHeaderValue,
  formatAddressList,
  MimeInputError,
  sanitizeSubject,
} from './google-mime';

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');
const headersOf = (raw: string) => decode(raw).split('\r\n\r\n')[0];
const decodeWords = (v: string) =>
  v
    .split('\r\n ')
    .map((w) => Buffer.from(w.replace(/^=\?UTF-8\?B\?|\?=$/g, ''), 'base64').toString('utf8'))
    .join('');

describe('formatAddressList — header injection + validation', () => {
  it.each(['a@b.com\r\nBcc: attacker@x.com', 'a@b.com\nBcc: attacker@x.com', 'a@b.com\rX: y'])(
    'rejects a recipient list with a line break (%j)',
    (to) => {
      expect(() => formatAddressList(to)).toThrow(new MimeInputError('The recipient list must not contain line breaks.'));
    },
  );

  it.each(['', '   ', ',;', undefined as any])('requires at least one recipient (%p)', (to) => {
    expect(() => formatAddressList(to)).toThrow('At least one recipient is required.');
  });

  it('caps the number of recipients at 50', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `u${i}@x.com`).join(',');
    expect(formatAddressList(fifty).split(', ')).toHaveLength(50);
    expect(() => formatAddressList(`${fifty},extra@x.com`)).toThrow('Too many recipients (max 50).');
  });

  it.each(['not-an-email', 'a@b', 'a b@c.com', '<a@b.com', 'Name <bad>', 'a@b.com>'])(
    'rejects an invalid address %p',
    (to) => {
      expect(() => formatAddressList(to)).toThrow(MimeInputError);
    },
  );

  it('clips a huge invalid address in the error message', () => {
    const err = (() => {
      try {
        formatAddressList('x'.repeat(500));
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err?.message.length).toBeLessThan(110);
  });

  it('splits on , and ; but not inside quotes or angle brackets', () => {
    expect(formatAddressList('a@b.com; "Doe, John" <j@d.com>, c@d.org')).toBe(
      'a@b.com, "Doe, John" <j@d.com>, c@d.org',
    );
  });

  it('drops empty/quoted-empty display names and escapes quotes/backslashes', () => {
    expect(formatAddressList('<a@b.com>')).toBe('a@b.com');
    expect(formatAddressList('"" <a@b.com>')).toBe('a@b.com');
    expect(formatAddressList('Ann "The" B\\x <a@b.com>')).toBe('"Ann \\"The\\" B\\\\x" <a@b.com>');
  });

  it('strips control characters from a display name', () => {
    expect(formatAddressList('Ann\u0007 Lee <a@b.com>')).toBe('"Ann Lee" <a@b.com>');
  });

  it('RFC 2047-encodes a non-ASCII display name', () => {
    const out = formatAddressList('Nguyễn Văn A <a@b.com>');
    expect(out).toMatch(/^=\?UTF-8\?B\?.+\?= <a@b\.com>$/);
    expect(decodeWords(out.replace(/ <a@b\.com>$/, ''))).toBe('Nguyễn Văn A');
  });
});

describe('encodeHeaderValue / sanitizeSubject', () => {
  it('keeps printable ASCII untouched', () => {
    expect(encodeHeaderValue('Plain subject 123 !?')).toBe('Plain subject 123 !?');
  });

  it('folds a long non-ASCII value into encoded words of <= 75 chars that round-trip', () => {
    const value = 'Báo cáo tuần — '.repeat(10) + '日本語テキスト';
    const out = encodeHeaderValue(value);
    const words = out.split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) expect(w.length).toBeLessThanOrEqual(75);
    expect(decodeWords(out)).toBe(value);
  });

  it('never splits a multi-byte character across words', () => {
    const out = encodeHeaderValue('😀'.repeat(30));
    for (const w of out.split('\r\n ')) {
      expect(decodeWords(w)).not.toContain('�');
    }
  });

  it('turns CR/LF into spaces and strips other controls', () => {
    expect(sanitizeSubject('  Hi\r\nBcc: x@y.com\u0000\u001b ')).toBe('Hi Bcc: x@y.com');
    expect(sanitizeSubject(undefined as any)).toBe('');
  });
});

describe('buildMimeMessage', () => {
  it('cannot be used to inject a header through the subject', () => {
    const raw = buildMimeMessage({ to: 'a@b.com', subject: 'Hi\r\nBcc: evil@x.com', body: 'b' });
    const headers = headersOf(raw).split('\r\n');
    expect(headers).toEqual([
      'To: a@b.com',
      'Subject: Hi Bcc: evil@x.com',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
    ]);
  });

  it('base64-encodes a UTF-8 body wrapped at 76 columns', () => {
    const body = 'Xin chào! '.repeat(40);
    const text = decode(buildMimeMessage({ to: 'a@b.com', subject: 'S', body }));
    const encoded = text.split('\r\n\r\n')[1];
    for (const line of encoded.split('\r\n')) expect(line.length).toBeLessThanOrEqual(76);
    expect(Buffer.from(encoded.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe(body);
  });

  it('accepts a missing body and is base64url (no + / =)', () => {
    const raw = buildMimeMessage({ to: 'a@b.com', subject: 'S', body: undefined as any });
    expect(raw).not.toMatch(/[+/=]/);
    expect(decode(raw).endsWith('\r\n\r\n')).toBe(true);
  });
});
