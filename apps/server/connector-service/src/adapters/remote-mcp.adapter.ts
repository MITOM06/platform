import { Injectable } from '@nestjs/common';
import { McpAuth, McpClientService, McpTool } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import { ConnectionLike, ProviderAdapter } from './provider-adapter.interface';

/**
 * Talks to remote MCP servers — the existing path for Notion (OAuth bearer) and
 * custom MCP servers (apikey/bearer/none). Preserves the previous
 * `authForConnection`/`authForType` logic verbatim, just behind the adapter
 * interface.
 */
@Injectable()
export class RemoteMcpAdapter implements ProviderAdapter {
  constructor(
    private readonly mcp: McpClientService,
    private readonly vault: TokenVaultService,
  ) {}

  listTools(conn: ConnectionLike): Promise<McpTool[]> {
    const { url, auth } = this.resolve(conn);
    return this.mcp.listTools(url, auth);
  }

  callTool(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const { url, auth } = this.resolve(conn);
    return this.mcp.callTool(url, auth, tool, input);
  }

  /** Resolve the target URL + auth for either a built-in or custom connection. */
  private resolve(conn: ConnectionLike): { url: string; auth: McpAuth } {
    if (conn.encryptedTokens) {
      const tokens = JSON.parse(this.vault.decrypt(conn.encryptedTokens));
      return {
        url: conn.mcpUrl ?? '',
        auth: { type: 'bearer', token: tokens.access_token },
      };
    }
    const credential = conn.encryptedCredential
      ? this.vault.decrypt(conn.encryptedCredential)
      : undefined;
    return {
      url: conn.url ?? '',
      auth: this.authForType(conn.authType, credential),
    };
  }

  private authForType(authType?: string, credential?: string): McpAuth {
    if (authType === 'oauth2') return { type: 'bearer', token: credential };
    if (authType === 'apikey') return { type: 'apikey', token: credential };
    return { type: 'none' };
  }
}
