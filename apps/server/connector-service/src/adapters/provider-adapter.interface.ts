import { McpTool } from '../mcp/mcp-client.service';
import { EncBlob } from '../vault/token-vault.service';

/**
 * The minimal connection shape an adapter needs to fetch/run tools. Covers both
 * a built-in OAuth connection (`mcpUrl` + `encryptedTokens`) and a custom MCP
 * server (`url` + `authType` + `encryptedCredential`). `_id` lets adapters
 * persist refreshed tokens back to the source document.
 */
export interface ConnectionLike {
  provider: string;
  mcpUrl?: string;
  encryptedTokens?: EncBlob;
  url?: string;
  authType?: string;
  encryptedCredential?: EncBlob;
  _id?: unknown;
}

/**
 * Strategy for turning a connection into a tool list and executing a tool.
 * `RemoteMcpAdapter` talks to a remote MCP server (Notion + custom); the
 * `GoogleRestAdapter` exposes static tool defs backed by Google REST APIs. The
 * `mcp__<provider>__<tool>` naming is owned by the caller (internal.service).
 */
export interface ProviderAdapter {
  listTools(conn: ConnectionLike): Promise<McpTool[]>;
  callTool(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string>;
}
