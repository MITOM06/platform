/**
 * Fail-closed environment checks for connector-service.
 *
 * The other three services already refuse to boot when production is handed a
 * development environment (auth/ai `main.ts`, chat-service `ProdEnvironmentGuard`).
 * connector-service was the exception: every value in `configuration.ts` carries a
 * localhost default, so a missing secret produced a *healthy* revision that dialled
 * nothing — and, worse, `enableCors({ origin: true })` reflected whatever origin
 * asked, with `credentials: true`, whenever CLIENT_REDIRECT_URL was unset.
 *
 * Kept as pure functions so the rules are unit-testable without a Nest context.
 */

/** Hosts that can only ever mean "this container", never a real backing service. */
const LOOPBACK = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i;

/** Origins the browser may call from when nothing is configured (development only). */
export const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8081',
];

export type Env = Record<string, string | undefined>;

/**
 * Addresses and secrets that must be real in production. Returns one message per
 * problem; an empty array means the environment is acceptable.
 */
export function findEnvProblems(env: Env): string[] {
  const problems: string[] = [];

  const addresses: Array<[string, string | undefined]> = [
    ['MONGO_URI', env.MONGO_URI],
    ['OAUTH_REDIRECT_BASE', env.OAUTH_REDIRECT_BASE],
    ['CLIENT_REDIRECT_URL', env.CLIENT_REDIRECT_URL],
  ];
  for (const [key, value] of addresses) {
    if (!value) {
      problems.push(`${key} is unset`);
    } else if (LOOPBACK.test(value)) {
      problems.push(`${key} = ${value} — that is this container, not a real address`);
    }
  }

  // A blank shared secret is not a broken address, it is an open door: the
  // internal tools API guard compares against '' and every caller passes.
  for (const key of ['INTERNAL_API_KEY', 'JWT_ACCESS_SECRET'] as const) {
    if (!env[key]) problems.push(`${key} is unset`);
  }

  // Bot Factory bridge (optional feature). Unset MCP_SERVER_URL just disables
  // it (see findEnvWarnings) unless the deployment says it relies on it; a SET
  // value must be the real public https endpoint Bot Factory can reach.
  const mcpServerUrl = env.MCP_SERVER_URL;
  if (mcpServerUrl) {
    if (LOOPBACK.test(mcpServerUrl)) {
      problems.push(`MCP_SERVER_URL = ${mcpServerUrl} — that is this container, Bot Factory cannot reach it`);
    } else if (!/^https:\/\//i.test(mcpServerUrl)) {
      problems.push('MCP_SERVER_URL must be an https URL');
    }
  } else if (env.BOT_BRIDGE_ENABLED === 'true') {
    problems.push('MCP_SERVER_URL is unset but BOT_BRIDGE_ENABLED=true');
  }

  return problems;
}

/**
 * Non-fatal production misconfigurations, logged at error level on boot.
 * Kept separate so optional features never block a deployment that does not
 * use them.
 */
export function findEnvWarnings(env: Env): string[] {
  const warnings: string[] = [];
  if (!env.MCP_SERVER_URL) {
    warnings.push(
      'MCP_SERVER_URL is unset — the Bot Factory bridge is disabled; bot session issue ' +
        'endpoints answer 503 BOT_BRIDGE_DISABLED. Set it to https://<public host>/<prefix>/mcp.',
    );
  }
  if (env.CONNECTOR_DEV_ALLOW_HOSTS) {
    warnings.push('CONNECTOR_DEV_ALLOW_HOSTS is set but ignored in production.');
  }
  return warnings;
}

/**
 * The browser origins allowed to call this service with credentials.
 *
 * `CORS_ORIGINS` (comma-separated) is the explicit answer and matches auth-service
 * and ai-service. Falling back to the origin of CLIENT_REDIRECT_URL keeps every
 * existing deployment working unchanged — that is what this service effectively
 * allowed before. Production never reaches the dev list.
 */
export function resolveAllowedOrigins(env: Env): string[] {
  const configured = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.length) return configured;

  const clientRedirect = env.CLIENT_REDIRECT_URL;
  if (clientRedirect) {
    try {
      return [new URL(clientRedirect).origin];
    } catch {
      // Malformed — fall through; production fails below, dev uses the dev list.
    }
  }

  if (env.NODE_ENV === 'production') return [];
  return DEV_ORIGINS;
}
