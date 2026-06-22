import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { McpAuth, McpClientService, McpTool } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import { McpOAuthService, McpTokenResponse } from '../oauth/mcp-oauth.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import { ConnectionLike, ProviderAdapter } from './provider-adapter.interface';

/**
 * Talks to remote MCP servers — the path for Notion (OAuth bearer), directory
 * connections (MCP-native OAuth bearer, pre-emptively refreshed), and custom
 * MCP servers (apikey/bearer/none).
 */
@Injectable()
export class RemoteMcpAdapter implements ProviderAdapter {
  private readonly logger = new Logger(RemoteMcpAdapter.name);

  constructor(
    private readonly mcp: McpClientService,
    private readonly vault: TokenVaultService,
    private readonly mcpOAuth: McpOAuthService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
  ) {}

  async listTools(conn: ConnectionLike): Promise<McpTool[]> {
    const { url, auth } = await this.resolve(conn);
    return this.mcp.listTools(url, auth);
  }

  async callTool(
    conn: ConnectionLike,
    tool: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const { url, auth } = await this.resolve(conn);
    return this.mcp.callTool(url, auth, tool, input);
  }

  /** Resolve the target URL + auth for a built-in/directory or custom connection. */
  private async resolve(
    conn: ConnectionLike,
  ): Promise<{ url: string; auth: McpAuth }> {
    if (conn.encryptedTokens) {
      const token = await this.validBearer(conn);
      return {
        url: conn.mcpUrl ?? '',
        auth: { type: 'bearer', token },
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

  /**
   * Current access token, pre-emptively refreshed when within 60s of expiry
   * for directory connections that carry a refresh_token + token endpoint +
   * encrypted DCR client creds. Falls back to the stored access token.
   */
  private async validBearer(conn: ConnectionLike): Promise<string | undefined> {
    const tokens = JSON.parse(
      this.vault.decrypt(conn.encryptedTokens!),
    ) as McpTokenResponse;

    const canRefresh =
      !!tokens.refresh_token &&
      !!conn.tokenEndpoint &&
      !!conn.encryptedClientCreds &&
      typeof tokens.expiry_date === 'number';

    if (canRefresh && tokens.expiry_date! < Date.now() + 60_000) {
      const refreshed = await this.tryRefresh(conn, tokens).catch((err) => {
        this.logger.warn(
          `Directory token refresh failed for ${conn.provider}: ${(err as Error).message}`,
        );
        return null;
      });
      if (refreshed) return refreshed;
    }
    return tokens.access_token;
  }

  private async tryRefresh(
    conn: ConnectionLike,
    tokens: McpTokenResponse,
  ): Promise<string | null> {
    const creds = JSON.parse(
      this.vault.decrypt(conn.encryptedClientCreds!),
    ) as { client_id: string; client_secret?: string };

    const next = await this.mcpOAuth.refresh({
      tokenEndpoint: conn.tokenEndpoint!,
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      refreshToken: tokens.refresh_token!,
      resource: conn.mcpUrl ?? '',
    });
    // Preserve the refresh_token if the server didn't return a new one.
    const merged: McpTokenResponse = {
      ...tokens,
      ...next,
      refresh_token: next.refresh_token ?? tokens.refresh_token,
    };
    if (conn._id) {
      await this.connModel.updateOne(
        { _id: conn._id },
        { $set: { encryptedTokens: this.vault.encrypt(JSON.stringify(merged)) } },
      );
    }
    return merged.access_token;
  }

  private authForType(authType?: string, credential?: string): McpAuth {
    if (authType === 'oauth2') return { type: 'bearer', token: credential };
    if (authType === 'apikey') return { type: 'apikey', token: credential };
    return { type: 'none' };
  }
}
