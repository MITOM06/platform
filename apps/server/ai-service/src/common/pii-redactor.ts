/**
 * Lightweight, dependency-free PII / secret redaction for AT-REST data
 * (structured logs and stored memory facts). It is deliberately NOT applied to
 * the live model context — the model still receives real data so answer quality
 * is unaffected. This only scrubs what we persist or log.
 *
 * Granular by design: logs redact everything; long-term memory keeps legitimate
 * user facts (email/phone) but never stores payment numbers or credentials.
 */

export interface RedactOptions {
  /** Mask email addresses → `a***@***.com`. */
  email?: boolean;
  /** Mask phone / long numeric runs (9–19 digits) → `[REDACTED]`. */
  phone?: boolean;
  /** Mask card-length numeric runs → `[REDACTED]` (folded into the numeric pass). */
  card?: boolean;
  /** Mask API keys / tokens (sk-, ghp_, AWS AKIA…, bearer-like) → `[REDACTED]`. */
  secret?: boolean;
}

/** Everything on — used for logs, where nothing needs to stay readable. */
export const REDACT_ALL: Required<RedactOptions> = {
  email: true,
  phone: true,
  card: true,
  secret: true,
};

/**
 * For long-term memory: keep emails & phones (they are valid, useful user facts)
 * but never persist credentials or full card numbers.
 */
export const REDACT_SECRETS_ONLY: RedactOptions = {
  email: false,
  phone: false,
  card: true,
  secret: true,
};

const REDACTED = '[REDACTED]';

// Provider-prefixed API keys and common token shapes.
const SECRET_RE =
  /\b(?:sk-ant|sk|pk|rk|ghp|gho|ghs|ghr|xox[baprs])[-_][A-Za-z0-9-_]{8,}\b/gi;
// AWS access key id.
const AWS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/g;
// `Bearer <token>` / `Authorization: <token>` style.
const BEARER_RE = /\b[Bb]earer\s+[A-Za-z0-9._\-]{12,}\b/g;
// Email — capture first local char + the TLD so the mask is still recognizable.
const EMAIL_RE = /([A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]*@[A-Za-z0-9.\-]+\.([A-Za-z]{2,})/g;
// Candidate numeric run (phone / card). A callback counts the actual digits so
// short numbers, years and dates (≤8 digits) are left untouched.
const NUMERIC_RE = /(?<!\d)[+(]?\d[\d\s().\-]{6,}\d(?!\d)/g;

/**
 * Redact PII / secrets from a string. Order matters: credentials and emails are
 * scrubbed before the numeric pass so their embedded digits aren't double-handled.
 */
export function redactPii(input: string, opts: RedactOptions = REDACT_ALL): string {
  if (!input) return input;
  let out = input;

  if (opts.secret) {
    out = out
      .replace(SECRET_RE, REDACTED)
      .replace(AWS_KEY_RE, REDACTED)
      .replace(BEARER_RE, REDACTED);
  }

  if (opts.email) {
    out = out.replace(EMAIL_RE, (_m, first: string, tld: string) => `${first}***@***.${tld}`);
  }

  if (opts.phone || opts.card) {
    // phone runs start at 9 digits; card-only mode keeps phones and scrubs
    // card-length runs (13–19 digits) so legitimate user phone facts survive.
    const minDigits = opts.phone ? 9 : 13;
    out = out.replace(NUMERIC_RE, (match) => {
      const digits = match.replace(/\D/g, '').length;
      return digits >= minDigits && digits <= 19 ? REDACTED : match;
    });
  }

  return out;
}

/** Redact every string in an array (e.g. memory key-facts) at rest. */
export function redactAll(values: string[], opts: RedactOptions = REDACT_ALL): string[] {
  return values.map((v) => redactPii(v, opts));
}
