// ── Connector-service DTOs — single source of truth for the web client ──────
// Mirrors the connector-service (:3003) public REST contract. Encrypted token
// blobs never reach the client; these types only ever describe status + metadata.
// Define once here, import everywhere (same convention as lib/api/types.ts).

/** Auth mechanism a connector / custom MCP server uses. */
export type ConnectorAuthType = 'oauth2' | 'apikey' | 'none'

/** Lifecycle status of an established user connection. */
export type ConnectionStatus = 'active' | 'expired' | 'revoked'

/** `GET /catalog` entry — public projection (no secret env values). */
export interface CatalogEntry {
  id: string
  name: string
  icon: string
  description: string
  scopes: string[]
  authType: ConnectorAuthType
  mcpUrl: string
  available: boolean
}

/** `GET /connections?userId=` item — metadata only, never secrets. */
export interface ConnectionView {
  id: string
  provider: string
  status: ConnectionStatus
  scopes: string[]
  accountLabel: string | null
  lastUsedAt: string | null
}

/** `GET /oauth/:provider/start?userId=` response. */
export interface OAuthStartResponse {
  authorizeUrl: string
}

/** `POST /custom-mcp/discover` request body. */
export interface CustomMcpDiscoverInput {
  url: string
  authType: ConnectorAuthType
  credential?: string
}

/** A single tool surfaced by an MCP server during discovery. */
export interface McpToolPreview {
  name: string
  description: string
}

/** `POST /custom-mcp/discover` response. */
export interface CustomMcpDiscoverResponse {
  tools: McpToolPreview[]
}

/** `POST /custom-mcp` request body (credential encrypted server-side). */
export interface CustomMcpInput {
  name: string
  url: string
  authType: ConnectorAuthType
  credential?: string
}

/** `GET /skills?userId=` item / `PUT /skills` payload shape. */
export interface UserSkillState {
  skillId: string
  enabled: boolean
}

// ── MCP Directory (dynamic connector directory) ─────────────────────────────

/** How a directory entry authenticates a connection. */
export type DirectoryAuthMode = 'mcp-oauth' | 'env-oauth' | 'apikey' | 'none'

/** Governance tier of a directory entry. */
export type DirectoryTier = 'workspace' | 'personal' | 'both'

/** `GET /directory` entry — public projection (no env secret names). */
export interface DirectoryEntry {
  id: string
  slug: string
  name: string
  icon: string
  description: string
  mcpUrl: string
  authMode: DirectoryAuthMode
  tier: DirectoryTier
  scopes: string[]
  available: boolean
  builtin: boolean
}

/** `GET /oauth/directory/:slug/start` response — varies by authMode. */
export type DirectoryStartResponse =
  | { mode: 'oauth'; authorizeUrl: string }
  | { mode: 'apikey' }
  | { mode: 'none'; connected: true }

/** `POST /directory` request body (admin). */
export interface CreateDirectoryEntryInput {
  slug: string
  name: string
  icon?: string
  description?: string
  mcpUrl: string
  authMode: DirectoryAuthMode
  tier?: DirectoryTier
  scopes?: string[]
  envClientIdName?: string
  envClientSecretName?: string
  authorizeUrl?: string
  tokenUrl?: string
  available?: boolean
}

/** `PATCH /directory/:id` request body (admin) — all fields optional. */
export type UpdateDirectoryEntryInput = Partial<
  Omit<CreateDirectoryEntryInput, 'slug'>
>
