export type CatalogAuthType = 'oauth2' | 'apikey' | 'none';

export interface CatalogOAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  scopes: string[];
  authType: CatalogAuthType;
  mcpUrl: string;
  available: boolean;
  // Internal OAuth config — NEVER serialized to clients. The controller maps
  // entries to a public DTO that drops this field entirely.
  oauth?: CatalogOAuthConfig;
}

/**
 * Public, client-safe view of a catalog entry. Drops the `oauth` internals
 * (authorize/token URLs + the env-var names holding client id/secret).
 */
export interface CatalogEntryView {
  id: string;
  name: string;
  icon: string;
  description: string;
  scopes: string[];
  authType: CatalogAuthType;
  available: boolean;
}

/**
 * Static registry of built-in connectors. P1 ships Notion only (available);
 * gmail/calendar/drive are present-but-disabled placeholders so the UI can
 * show them as "coming soon" without exposing real OAuth wiring.
 *
 * `mcpUrl` and OAuth client id/secret are resolved from env at OAuth time
 * (see OAuthService); here we only reference the env-var NAMES.
 */
export const CATALOG: CatalogEntry[] = [
  {
    id: 'notion',
    name: 'Notion',
    icon: 'notion',
    description: 'Create and update Notion pages and databases from chat.',
    scopes: ['read_content', 'update_content', 'insert_content'],
    authType: 'oauth2',
    mcpUrl: process.env.NOTION_MCP_URL ?? 'https://mcp.notion.com/sse',
    available: true,
    oauth: {
      authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      clientIdEnv: 'NOTION_CLIENT_ID',
      clientSecretEnv: 'NOTION_CLIENT_SECRET',
    },
  },
  // ── Coming soon (P5) — disabled placeholders, no real OAuth config yet ──
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'gmail',
    description: 'Draft and send email on your behalf.',
    scopes: [],
    authType: 'oauth2',
    mcpUrl: '',
    available: false,
    // oauth: { authorizeUrl: '...', tokenUrl: '...', clientIdEnv: 'GMAIL_CLIENT_ID', clientSecretEnv: 'GMAIL_CLIENT_SECRET' },
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: 'calendar',
    description: 'Schedule and manage events.',
    scopes: [],
    authType: 'oauth2',
    mcpUrl: '',
    available: false,
    // oauth: { authorizeUrl: '...', tokenUrl: '...', clientIdEnv: 'GCAL_CLIENT_ID', clientSecretEnv: 'GCAL_CLIENT_SECRET' },
  },
  {
    id: 'drive',
    name: 'Google Drive',
    icon: 'drive',
    description: 'Search and read files in Drive.',
    scopes: [],
    authType: 'oauth2',
    mcpUrl: '',
    available: false,
    // oauth: { authorizeUrl: '...', tokenUrl: '...', clientIdEnv: 'GDRIVE_CLIENT_ID', clientSecretEnv: 'GDRIVE_CLIENT_SECRET' },
  },
];

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}

export function toCatalogView(entry: CatalogEntry): CatalogEntryView {
  return {
    id: entry.id,
    name: entry.name,
    icon: entry.icon,
    description: entry.description,
    scopes: entry.scopes,
    authType: entry.authType,
    available: entry.available,
  };
}
