/**
 * Typed env config for connector-service.
 *
 * Boot-time invariant: CONNECTOR_VAULT_KEY must base64-decode to exactly 32 bytes
 * (AES-256 key length). If it does not, we throw here so the service refuses to
 * start rather than failing later inside the token vault.
 */
function assertVaultKey(): string {
  const raw = process.env.CONNECTOR_VAULT_KEY ?? '';
  const len = Buffer.from(raw, 'base64').length;
  if (len !== 32) {
    throw new Error('CONNECTOR_VAULT_KEY must be 32 bytes');
  }
  return raw;
}

/** Bot session token lifetime in days (BOT_SESSION_TTL_DAYS, 1..3650, default 90). */
function botSessionTtlDays(): number {
  const n = Number.parseInt(process.env.BOT_SESSION_TTL_DAYS ?? '', 10);
  return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : 90;
}

export default function configuration() {
  const vaultKey = assertVaultKey();
  const isProd = process.env.NODE_ENV === 'production';
  return {
    port: parseInt(process.env.PORT ?? '3003', 10),
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27018/platform',
    vaultKey,
    internalApiKey: process.env.INTERNAL_API_KEY ?? '',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3003',
    clientRedirectUrl: process.env.CLIENT_REDIRECT_URL ?? 'http://localhost:3000/integrations',
    // Public URL Bot Factory calls (`<public origin>/mcp`). No localhost default
    // in production: an unset value disables issuing bot tokens (503
    // BOT_BRIDGE_DISABLED) instead of wiring assistants to an unreachable host.
    mcpServerUrl: process.env.MCP_SERVER_URL || (isProd ? '' : 'http://localhost:3003/mcp'),
    botSessionTtlDays: botSessionTtlDays(),
    notion: {
      clientId: process.env.NOTION_CLIENT_ID ?? '',
      clientSecret: process.env.NOTION_CLIENT_SECRET ?? '',
      mcpUrl: process.env.NOTION_MCP_URL ?? 'https://mcp.notion.com/sse',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  };
}
