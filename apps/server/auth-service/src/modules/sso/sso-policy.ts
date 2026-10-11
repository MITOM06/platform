/** The workspace SSO switches that decide "Require SSO" (+ the env check). */
export interface SsoSettings {
  enabled: boolean;
  enforced: boolean;
  allowedDomains: string[];
  /** OIDC configured for this deployment by env (OIDC_ENABLED + issuer + client id). */
  oidcConfigured: boolean;
}

/** `Acme.COM `, `@acme.com` → `acme.com`; empty when nothing is left. */
export function normalizeDomain(domain: unknown): string {
  if (typeof domain !== 'string') return '';
  return domain.trim().toLowerCase().replace(/^@+/, '');
}

/** Distinct, normalized, non-empty domains. */
export function normalizeDomains(
  domains: readonly unknown[] | null | undefined,
): string[] {
  return [...new Set((domains ?? []).map(normalizeDomain).filter(Boolean))];
}

/** Lower-cased domain part of an email (after the last `@`), or null. */
export function emailDomain(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  const domain = at >= 0 ? normalizeDomain(email.slice(at + 1)) : '';
  return domain || null;
}

/** Whether the email's domain is one of `domains` (case-insensitive, exact). */
export function emailInDomains(
  email: unknown,
  domains: readonly unknown[] | null | undefined,
): boolean {
  const domain = emailDomain(email);
  return !!domain && normalizeDomains(domains).includes(domain);
}

/**
 * "Require SSO" is in effect only when it is switched on AND SSO itself is
 * usable: enabled in the workspace, at least one allowed domain, and OIDC
 * configured by env. Otherwise members could not sign in at all, so a stored
 * `enforced: true` is inert (password sign-in works again).
 */
export function isEnforcementActive(s: SsoSettings): boolean {
  return (
    s.enforced &&
    s.enabled &&
    s.oidcConfigured &&
    normalizeDomains(s.allowedDomains).length > 0
  );
}

/** Escapes a string for a literal match inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
