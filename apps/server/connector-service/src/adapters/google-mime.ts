/**
 * RFC 5322 / MIME message building for the Gmail tools.
 *
 *  - Header injection: a CR/LF in a model-supplied `to` could append headers
 *    (`a@b.com\r\nBcc: attacker@x`). Recipient lists with line breaks are
 *    rejected; subjects are folded to one line.
 *  - Non-ASCII subjects and display names are RFC 2047 encoded-words
 *    (`=?UTF-8?B?…?=`), so Vietnamese/CJK subjects no longer arrive garbled.
 *  - The body is UTF-8 with explicit MIME headers and base64 transfer encoding.
 */
export class MimeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MimeInputError';
  }
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const LINE_BREAK = /[\r\n]/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const EMAIL = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;
const MAX_RECIPIENTS = 50;
/** 45 raw bytes → 60 base64 chars → 72-char encoded word (RFC 2047 limit is 75). */
const WORD_BYTES = 45;

/** Header value as-is when printable ASCII, else folded RFC 2047 B-encoded words. */
export function encodeHeaderValue(value: string): string {
  if (PRINTABLE_ASCII.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const ch of value) {
    if (chunk && Buffer.byteLength(chunk + ch, 'utf8') > WORD_BYTES) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}

/** One-line subject without control characters. */
export function sanitizeSubject(subject: string): string {
  return String(subject ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(CONTROL_CHARS, '')
    .trim();
}

/** Split on `,`/`;` outside quotes and angle brackets. */
function splitAddresses(raw: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  let angle = false;
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    else if (ch === '<' && !quoted) angle = true;
    else if (ch === '>' && !quoted) angle = false;
    if ((ch === ',' || ch === ';') && !quoted && !angle) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((p) => p.trim()).filter(Boolean);
}

function formatAddress(part: string): string {
  const match = part.match(/^(.*)<([^<>]+)>$/);
  const email = (match ? match[2] : part).trim();
  if (!EMAIL.test(email)) {
    throw new MimeInputError(`Invalid email address: ${email.slice(0, 80)}`);
  }
  if (!match) return email;
  let name = match[1].trim().replace(CONTROL_CHARS, '');
  if (name.length >= 2 && name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  if (!name) return email;
  if (PRINTABLE_ASCII.test(name)) return `"${name.replace(/(["\\])/g, '\\$1')}" <${email}>`;
  return `${encodeHeaderValue(name)} <${email}>`;
}

/** Validated, encoded `To:` value. Throws {@link MimeInputError}. */
export function formatAddressList(raw: string): string {
  const value = String(raw ?? '');
  if (LINE_BREAK.test(value)) {
    throw new MimeInputError('The recipient list must not contain line breaks.');
  }
  const parts = splitAddresses(value);
  if (!parts.length) throw new MimeInputError('At least one recipient is required.');
  if (parts.length > MAX_RECIPIENTS) {
    throw new MimeInputError(`Too many recipients (max ${MAX_RECIPIENTS}).`);
  }
  return parts.map(formatAddress).join(', ');
}

function wrap76(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/, '');
}

/** Complete RFC 5322 message, base64url-encoded for the Gmail API `raw` field. */
export function buildMimeMessage(input: { to: string; subject: string; body: string }): string {
  const message = [
    `To: ${formatAddressList(input.to)}`,
    `Subject: ${encodeHeaderValue(sanitizeSubject(input.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(String(input.body ?? ''), 'utf8').toString('base64')),
  ].join('\r\n');
  return Buffer.from(message, 'utf8').toString('base64url');
}
