import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SingleFlight } from '../common/single-flight';
import { connectionExpired } from '../internal/tool-errors';
import {
  httpStatusOf,
  McpAuth,
  McpClientOptions,
  McpClientService,
  McpTool,
} from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import { McpOAuthService, McpTokenResponse } from '../oauth/mcp-oauth.service';
import { TokenEndpointError } from '../oauth/oauth-errors';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import { ConnectionLike, ProviderAdapter, RevokeOutcome } from './provider-adapter.interface';

const REFRESH_SKEW_MS = 60_000;

type Op<T> = (url: string, auth: McpAuth, opts: McpClientOptions) => Promise<T>;

/**
 * Talks to remote MCP servers — Notion (OAuth bearer), directory connections
 * (MCP-native OAuth bearer, refreshed pre-emptively and on a 401) and custom
 * MCP servers (apikey/bearer/none).
 *
 * Refreshes are single-flight per connection and always start from the tokens
 * currently stored (another request may already have rotated them), so a
 * rotating refresh token is never presented twice. `invalid_grant` marks the
 * connection `expired` and surfaces a clean CONNECTION_EXPIRED error.
 */
@Injectable()
export class RemoteMcpAdapter implements ProviderAdapter {
  private readonly logger = new Logger(RemoteMcpAdapter.name);
  private readonly refreshes = new SingleFlight<string | undefined>();

  constructor(
    private readonly mcp: McpClientService,
    private readonly vault: TokenVaultService,
    private readonly mcpOAuth: McpOAuthService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
  ) {}

  listTools(conn: ConnectionLike): Promise<McpTool[]> {
    return this.withAuth(conn, (url, auth, opts) => this.mcp.listTools(url, auth, opts));
  }

  callTool(conn: ConnectionLike, tool: string, input: Record<string, unknown>): Promise<string> {
    return this.withAuth(conn, (url, auth, opts) => this.mcp.callTool(url, auth, tool, input, opts));
  }

  /** Remote MCP servers publish no revocation endpoint we store; just drop the cached client. */
  async revoke(conn: ConnectionLike): Promise<RevokeOutcome> {
    await this.mcp.evictConnection(this.connKey(conn));
    return 'unsupported';
  }

  private async withAuth<T>(conn: ConnectionLike, op: Op<T>): Promise<T> {
    const opts: McpClientOptions = { connKey: this.connKey(conn) };
    const first = await this.resolve(conn);
    try {
      return await op(first.url, first.auth, opts);
    } catch (err) {
      // A bearer the server rejects (expired early, revoked, rotated by another
      // instance): refresh once and retry. A 401 means nothing was executed.
      if (httpStatusOf(err) !== 401 || !this.canRefresh(conn)) throw err;
      const token = await this.refreshes.run(this.connKey(conn), () =>
        this.refreshLatest(conn, first.auth.token),
      );
      if (!token || token === first.auth.token) throw err;
      return op(first.url, { type: 'bearer', token }, opts);
    }
  }

  /** Resolve the target URL + auth for a built-in/directory or custom connection. */
  private async resolve(conn: ConnectionLike): Promise<{ url: string; auth: McpAuth }> {
    if (conn.encryptedTokens) {
      return { url: conn.mcpUrl ?? '', auth: { type: 'bearer', token: await this.validBearer(conn) } };
    }
    const credential = conn.encryptedCredential ? this.vault.decrypt(conn.encryptedCredential) : undefined;
    return { url: conn.url ?? '', auth: this.authForType(conn.authType, credential) };
  }

  /** Current access token, pre-emptively refreshed within 60s of expiry. */
  private async validBearer(conn: ConnectionLike): Promise<string | undefined> {
    const tokens = this.decodeTokens(conn.encryptedTokens!);
    if (!this.canRefresh(conn) || !RemoteMcpAdapter.expiringSoon(tokens)) {
      return tokens.access_token;
    }
    return this.refreshes.run(this.connKey(conn), () => this.refreshLatest(conn));
  }

  /**
   * Refresh from the STORED tokens. Pre-emptive: skip if they are no longer
   * expiring. Reactive (`rejectedToken`): skip if they already differ from the
   * token the server just rejected.
   */
  private async refreshLatest(conn: ConnectionLike, rejectedToken?: string): Promise<string | undefined> {
    let tokens = this.decodeTokens(conn.encryptedTokens!);
    if (conn._id) {
      const latest = await this.connModel
        .findById(conn._id, { encryptedTokens: 1, status: 1 })
        .lean<{ encryptedTokens?: ConnectionLike['encryptedTokens']; status?: string }>();
      if (latest?.status && latest.status !== 'active') throw connectionExpired(conn.provider);
      if (latest?.encryptedTokens) tokens = this.decodeTokens(latest.encryptedTokens);
    }
    if (rejectedToken === undefined ? !RemoteMcpAdapter.expiringSoon(tokens) : tokens.access_token !== rejectedToken) {
      return tokens.access_token;
    }
    if (!tokens.refresh_token) return tokens.access_token;

    try {
      const creds = JSON.parse(this.vault.decrypt(conn.encryptedClientCreds!)) as {
        client_id: string;
        client_secret?: string;
      };
      const next = await this.mcpOAuth.refresh({
        tokenEndpoint: conn.tokenEndpoint!,
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        refreshToken: tokens.refresh_token,
        resource: conn.mcpUrl ?? '',
      });
      // Keep the refresh_token if the server didn't rotate it.
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
    } catch (err) {
      if (err instanceof TokenEndpointError && err.oauthError === 'invalid_grant') {
        await this.markExpired(conn);
        throw connectionExpired(conn.provider);
      }
      this.logger.warn(`Token refresh failed for ${conn.provider}: ${(err as Error).message}`);
      return tokens.access_token;
    }
  }

  private async markExpired(conn: ConnectionLike): Promise<void> {
    if (!conn._id) return;
    try {
      await this.connModel.updateOne({ _id: conn._id }, { $set: { status: 'expired' } });
      this.logger.warn(`Marked ${conn.provider} connection ${String(conn._id)} expired (invalid_grant)`);
    } catch (err) {
      this.logger.warn(`Could not mark ${conn.provider} expired: ${(err as Error).message}`);
    }
  }

  private canRefresh(conn: ConnectionLike): boolean {
    if (!conn.encryptedTokens || !conn.tokenEndpoint || !conn.encryptedClientCreds) return false;
    return !!this.decodeTokens(conn.encryptedTokens).refresh_token;
  }

  private static expiringSoon(tokens: McpTokenResponse): boolean {
    return typeof tokens.expiry_date === 'number' && tokens.expiry_date < Date.now() + REFRESH_SKEW_MS;
  }

  private decodeTokens(blob: NonNullable<ConnectionLike['encryptedTokens']>): McpTokenResponse {
    return JSON.parse(this.vault.decrypt(blob)) as McpTokenResponse;
  }

  private connKey(conn: ConnectionLike): string {
    return String(conn._id ?? conn.provider);
  }

  private authForType(authType?: string, credential?: string): McpAuth {
    if (authType === 'oauth2') return { type: 'bearer', token: credential };
    if (authType === 'apikey') return { type: 'apikey', token: credential };
    return { type: 'none' };
  }
}
