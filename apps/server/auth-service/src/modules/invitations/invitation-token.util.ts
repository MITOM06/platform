import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

/** Accepted shape of a raw invitation token (base64url, 43 chars when minted here). */
const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

/** 256-bit random token, base64url (43 chars). Only ever placed in the email link. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex — the only form of the token that is persisted. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cheap shape check so garbage input never reaches the DB. */
export function isWellFormedInviteToken(token: unknown): token is string {
  return typeof token === 'string' && INVITE_TOKEN_RE.test(token);
}

/** Single-use id for the Google invite-accept flow (kept out of OAuth `state` raw token). */
export function generateFlowId(): string {
  return randomBytes(24).toString('base64url'); // 32 chars, matches the guard's [A-Za-z0-9_-]{16,64}
}

/**
 * Origin of WEB_REDIRECT_URL — the web client every email link points to.
 * Production is guaranteed to have WEB_REDIRECT_URL (main.ts refuses to boot
 * without it) — the fallback is the same local-web-dev fallback
 * `redirectWithLoginCode` has always used.
 */
function webOrigin(config: ConfigService): string {
  const webRedirect =
    config.get<string>('WEB_REDIRECT_URL') ||
    'http://localhost:3000/oauth-callback';
  return new URL(webRedirect).origin;
}

/** `${web origin}/invite/<token>`. */
export function buildInviteUrl(config: ConfigService, token: string): string {
  return new URL(`/invite/${token}`, webOrigin(config)).toString();
}

/** `${web origin}/login` — the "Open PON" button of the welcome email. */
export function buildWebLoginUrl(config: ConfigService): string {
  return new URL('/login', webOrigin(config)).toString();
}
