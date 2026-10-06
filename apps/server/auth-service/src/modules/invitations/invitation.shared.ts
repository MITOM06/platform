/** Minimal actor identity taken from the JWT. */
export interface InvitationActor {
  sub: string;
  role?: string;
  /** Capability keys of the actor (JWT `perms`) — bounds which roles they may invite with. */
  perms?: string[];
}

/** `invitedBy` value of the boot-time Owner invitation. */
export const SYSTEM_INVITER = 'system';
export const OWNER_ROLE = 'Owner';
export const MEMBER_ROLE = 'Member';

// Moved to common/email so the auth flows share one definition; re-exported for existing imports.
export { normalizeEmail } from '../../common/email';

/** Mongo E11000 (unique index violation). */
export function isDuplicateKey(e: unknown): boolean {
  return (e as { code?: number } | undefined)?.code === 11000;
}

/** "***@domain" — the only form of a recipient address that may be logged. */
export function maskEmail(email: string): string {
  return `***${email.slice(email.lastIndexOf('@'))}`;
}
