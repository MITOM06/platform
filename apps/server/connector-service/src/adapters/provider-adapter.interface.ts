import { McpTool } from '../mcp/mcp-client.service';
import { EncBlob } from '../vault/token-vault.service';

/**
 * The minimal connection shape an adapter needs to fetch/run tools. Covers both
 * a built-in OAuth connection (`mcpUrl` + `encryptedTokens`) and a custom MCP
 * server (`url` + `authType` + `encryptedCredential`). `_id` lets adapters
 * persist refreshed tokens (or an `expired` status) back to the source document.
 */
export interface ConnectionLike {
  provider: string;
  /** Owning member (built-in connections) — used e.g. to spot a shared Google grant. */
  userId?: string;
  mcpUrl?: string;
  encryptedTokens?: EncBlob;
  /** Directory connections: encrypted DCR client creds for token refresh. */
  encryptedClientCreds?: EncBlob;
  /** Directory connections: token endpoint for refresh (from discovery). */
  tokenEndpoint?: string;
  url?: string;
  authType?: string;
  encryptedCredential?: EncBlob;
  _id?: unknown;
}

/** Outcome of a best-effort revocation at the provider. */
export type RevokeOutcome = 'revoked' | 'skipped' | 'unsupported' | 'failed';

/**
 * Strategy for turning a connection into a tool list and executing a tool.
 * `RemoteMcpAdapter` talks to a remote MCP server (Notion, directory, custom);
 * `GoogleRestAdapter` exposes static tool defs backed by Google REST APIs. The
 * `mcp__<provider>__<tool>` naming is owned by the caller (internal.service).
 * Adapters throw `ToolExecutionError` for failures the model should see.
 */
export interface ProviderAdapter {
  listTools(conn: ConnectionLike): Promise<McpTool[]>;
  callTool(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string>;
  /** Best-effort revocation of the stored grant before the connection is deleted. */
  revoke?(conn: ConnectionLike): Promise<RevokeOutcome>;
}
