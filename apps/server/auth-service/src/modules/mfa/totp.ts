import { authenticator } from 'otplib';

/**
 * TOTP (RFC 6238) as used by Google Authenticator: SHA-1, 6 digits, 30 s step,
 * one step of clock drift accepted either way. Every otplib call lives in this
 * file, so a library upgrade only touches it.
 */
export const TOTP_ISSUER = 'PON';
export const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
/** 20 random bytes = 160-bit secret = 32 base32 characters. */
const TOTP_SECRET_BYTES = 20;

const base = authenticator.clone({
  step: TOTP_STEP_SECONDS,
  digits: TOTP_DIGITS,
  window: TOTP_WINDOW,
});

/** A fresh base32 secret (also the "manual entry" key shown to the user). */
export function generateTotpSecret(): string {
  return base.generateSecret(TOTP_SECRET_BYTES);
}

/** `otpauth://totp/PON:<email>?secret=…&issuer=PON&…` for the QR code. */
export function totpKeyUri(accountName: string, secret: string): string {
  return base.keyuri(accountName, TOTP_ISSUER, secret);
}

/** Normalises user input ("123 456" → "123456"); non-strings → ''. */
export function normalizeTotpInput(code: unknown): string {
  return typeof code === 'string' ? code.replace(/\s+/g, '') : '';
}

/**
 * The absolute time-step of a valid code, or null when the code is wrong.
 * The step lets the caller reject a replay of the same code (RFC 6238 §5.2).
 */
export function matchTotpStep(
  code: string,
  secret: string,
  nowMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = base.clone({ epoch: nowMs }).checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS) + delta;
}
