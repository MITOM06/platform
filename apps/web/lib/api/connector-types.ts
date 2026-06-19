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
