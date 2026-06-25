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

export default function configuration() {
  const vaultKey = assertVaultKey();
  return {
    port: parseInt(process.env.PORT ?? '3003', 10),
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27018/platform',
    vaultKey,
    internalApiKey: process.env.INTERNAL_API_KEY ?? '',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3003',
    clientRedirectUrl: process.env.CLIENT_REDIRECT_URL ?? 'http://localhost:3000/integrations',
    mcpServerUrl: process.env.MCP_SERVER_URL ?? 'http://localhost:3003/mcp',
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
