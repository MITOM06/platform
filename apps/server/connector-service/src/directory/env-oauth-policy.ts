/**
 * Which server env vars an `env-oauth` directory entry may reference for its
 * OAuth client credentials, and where those credentials may be sent.
 *
 * Without this, a MANAGE_WORKSPACE holder could set `envClientIdName:
 * 'JWT_ACCESS_SECRET'` (sent in the authorize URL) and `envClientSecretName:
 * 'CONNECTOR_VAULT_KEY'` (POSTed to an attacker-chosen token URL at the
 * callback) and walk away with the service's infrastructure secrets.
 *
 * Rules (checked at create/update AND at connect time):
 *  - client id var: `OAUTH_<NAME>_CLIENT_ID`, or the built-in `GOOGLE_CLIENT_ID` / `NOTION_CLIENT_ID`;
 *  - client secret var: the matching `…_CLIENT_SECRET` of the SAME pair;
 *  - the built-in Google/Notion credentials may only be sent to that provider's hosts;
 *  - authorize/token URLs must be https (the token URL also passes the SSRF guard).
 */
export const CLIENT_ID_ENV_PATTERN = /^(OAUTH_[A-Z0-9_]{1,40}_CLIENT_ID|GOOGLE_CLIENT_ID|NOTION_CLIENT_ID)$/;
export const CLIENT_SECRET_ENV_PATTERN =
  /^(OAUTH_[A-Z0-9_]{1,40}_CLIENT_SECRET|GOOGLE_CLIENT_SECRET|NOTION_CLIENT_SECRET)$/;

/** Built-in credential pairs shared with the static catalog, pinned to their provider hosts. */
const PINNED_HOSTS: Record<string, readonly string[]> = {
  GOOGLE: ['accounts.google.com', 'oauth2.googleapis.com'],
  NOTION: ['api.notion.com'],
};

export interface EnvOAuthConfig {
  envClientIdName?: string;
  envClientSecretName?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
}

/** `GOOGLE`, `NOTION` or `OAUTH_<NAME>` — the credential pair a var name belongs to. */
function pairOf(name: string, suffix: '_CLIENT_ID' | '_CLIENT_SECRET'): string | null {
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : null;
}

function httpsHost(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Human-readable problems with an env-oauth configuration ([] = acceptable). */
export function envOAuthProblems(cfg: EnvOAuthConfig, opts: { allowHttp?: boolean } = {}): string[] {
  const problems: string[] = [];
  const id = cfg.envClientIdName ?? '';
  const secret = cfg.envClientSecretName;
  if (!CLIENT_ID_ENV_PATTERN.test(id)) {
    problems.push('envClientIdName must be OAUTH_<NAME>_CLIENT_ID (or GOOGLE_/NOTION_CLIENT_ID)');
  }
  if (secret !== undefined && secret !== '' && !CLIENT_SECRET_ENV_PATTERN.test(secret)) {
    problems.push('envClientSecretName must be OAUTH_<NAME>_CLIENT_SECRET (or GOOGLE_/NOTION_CLIENT_SECRET)');
  }
  const pair = pairOf(id, '_CLIENT_ID');
  if (secret && pair && pairOf(secret, '_CLIENT_SECRET') !== pair) {
    problems.push('envClientIdName and envClientSecretName must belong to the same credential pair');
  }

  const checkUrl = (field: 'authorizeUrl' | 'tokenUrl'): string | null => {
    const raw = cfg[field];
    if (!raw) {
      problems.push(`${field} is required`);
      return null;
    }
    const host = httpsHost(raw);
    if (!host && !(opts.allowHttp && /^http:\/\//i.test(raw))) problems.push(`${field} must be an https URL`);
    return host;
  };
  const hosts = [checkUrl('authorizeUrl'), checkUrl('tokenUrl')];

  const pinned = pair ? PINNED_HOSTS[pair] : undefined;
  if (pinned && hosts.some((h) => !h || !pinned.includes(h))) {
    problems.push(`${pair} credentials may only be used with ${pinned.join(' / ')}`);
  }
  return problems;
}
