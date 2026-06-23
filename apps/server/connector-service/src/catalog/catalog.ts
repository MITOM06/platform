export type CatalogAuthType = 'oauth2' | 'apikey' | 'none';

/**
 * Governance tier of a connector:
 *  - 'workspace': shared org connector; connecting requires CONNECT_WORKSPACE_CONNECTOR.
 *  - 'personal':  per-member connector; requires CONNECT_PERSONAL_CONNECTOR + allow-list.
 *  - 'both':      may be connected either way (defaults to personal flow here).
 */
export type CatalogTier = 'workspace' | 'personal' | 'both';

export interface CatalogOAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Token-exchange auth: 'basic' (Notion) or 'body' (Google). Default 'basic'. */
  authStyle?: 'basic' | 'body';
  /** Token-exchange body encoding. Default 'json' (Notion); Google uses 'form'. */
  bodyFormat?: 'json' | 'form';
  /** Extra params appended to the authorize URL (e.g. Google offline+consent). */
  extraAuthorizeParams?: Record<string, string>;
  /** Append `scope=<space-joined entry.scopes>` to the authorize URL (Google). */
  includeScope?: boolean;
  /** Append `owner=user` to the authorize URL (Notion). */
  ownerParam?: boolean;
}

/**
 * How a connector's tools are fetched/executed:
 *  - 'remote-mcp': talk to a remote MCP server (Notion + custom servers).
 *  - 'google-rest': static tool defs backed by Google REST APIs (Gmail/Calendar).
 */
export type CatalogAdapter = 'remote-mcp' | 'google-rest';

export interface CatalogEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  scopes: string[];
  authType: CatalogAuthType;
  /** Governance tier (defaults to 'personal' when omitted). */
  tier: CatalogTier;
  /** Tool-execution adapter (defaults to 'remote-mcp'). */
  adapter: CatalogAdapter;
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
  tier: CatalogTier;
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
    tier: 'both',
    adapter: 'remote-mcp',
    mcpUrl: process.env.NOTION_MCP_URL ?? 'https://mcp.notion.com/sse',
    available: true,
    oauth: {
      authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      clientIdEnv: 'NOTION_CLIENT_ID',
      clientSecretEnv: 'NOTION_CLIENT_SECRET',
      authStyle: 'basic',
      bodyFormat: 'json',
      ownerParam: true,
    },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'gmail',
    description: 'Draft and send email on your behalf.',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    authType: 'oauth2',
    tier: 'personal',
    adapter: 'google-rest',
    mcpUrl: '',
    available: true,
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      authStyle: 'body',
      bodyFormat: 'form',
      includeScope: true,
      extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    },
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: 'calendar',
    description: 'Schedule and manage events.',
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    authType: 'oauth2',
    tier: 'personal',
    adapter: 'google-rest',
    mcpUrl: '',
    available: true,
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      authStyle: 'body',
      bodyFormat: 'form',
      includeScope: true,
      extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    },
  },
  // ── Coming soon — disabled placeholder, no real OAuth config yet ──
  {
    id: 'drive',
    name: 'Google Drive',
    icon: 'drive',
    description: 'Search and read files in Drive.',
    scopes: [],
    authType: 'oauth2',
    tier: 'personal',
    adapter: 'google-rest',
    mcpUrl: '',
    available: false,
  },
];

/**
 * Bare MCP tool names considered "sensitive" — they send mail or perform
 * external writes/creates. These are filtered out of a user's tool set (and
 * blocked at call time) unless the user holds RUN_SENSITIVE_SKILL. Matched on
 * the bare tool name (the `<tool>` part of `mcp__<provider>__<tool>`), case-
 * insensitively, so naming variants across MCP servers are covered.
 */
export const SENSITIVE_TOOLS: ReadonlySet<string> = new Set([
  // Email
  'send_email',
  'send_message',
  // Notion page/database writes
  'create_page',
  'update_page',
  'create_database',
  'update_database',
  'create-pages',
  'update-page',
  // Generic external writes
  'create_event',
  'update_event',
  'delete_event',
  'create_file',
  'update_file',
  'delete_file',
]);

/** True if a bare MCP tool name is tagged sensitive (case-insensitive). */
export function isSensitiveTool(toolName: string): boolean {
  return SENSITIVE_TOOLS.has(toolName.toLowerCase());
}

/**
 * Action groups a connection can grant the AI on a third-party app. Each tool
 * maps to exactly ONE group (the action it performs); a tool is usable only
 * when its group is granted on the connection.
 */
export type ActionGroup = 'view' | 'create' | 'edit' | 'delete';

export const ALL_ACTION_GROUPS: readonly ActionGroup[] = ['view', 'create', 'edit', 'delete'];

// Explicit overrides for known catalog tools whose name doesn't pattern-match cleanly.
const TOOL_ACTION_GROUP: ReadonlyMap<string, ActionGroup> = new Map([
  ['send_email', 'create'],
  ['send_message', 'create'],
  ['create_draft', 'create'],
  ['suggest_time', 'view'],
  ['search_threads', 'view'],
  ['list_events', 'view'],
]);

/**
 * Classify a bare MCP tool name into a single action group. Explicit overrides
 * win; otherwise verb patterns are matched in order of severity
 * (delete > edit > create > view) so e.g. `update_and_notify` reads as `edit`.
 * Unknown/read-like tools default to the least-privileged `view`.
 */
export function classifyToolActionGroup(toolName: string): ActionGroup {
  const name = toolName.toLowerCase();
  const override = TOOL_ACTION_GROUP.get(name);
  if (override) return override;
  if (/(^|[_\-])(delete|remove|trash|archive|revoke|cancel)/.test(name)) return 'delete';
  if (/(^|[_\-])(update|edit|modify|patch|move|rename|replace|set)/.test(name)) return 'edit';
  if (/(^|[_\-])(create|insert|add|send|compose|write|post|publish|new|upload|draft)/.test(name))
    return 'create';
  return 'view';
}

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
    tier: entry.tier,
    available: entry.available,
  };
}
