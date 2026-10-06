import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtUser } from '@platform/database';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditService } from '../audit/audit.service';
import { DirectoryService, assertDirectoryEntrySafe } from '../directory/directory.service';
import { McpDirectoryEntryDocument } from '../connections/schemas/mcp-directory-entry.schema';
import { ConnectionScope } from '../connections/schemas/user-connection.schema';
import {
  CATALOG_ONLY_FIELDS,
  ConnectionStoreService,
  DIRECTORY_ONLY_FIELDS,
} from '../connections/connection-store.service';
import { OAuthService } from './oauth.service';
import { McpOAuthService, McpTokenResponse } from './mcp-oauth.service';
import { callbackErrorCode, OAuthFlowError, providerErrorCode } from './oauth-errors';

/** Sensitive transient data stashed (vault-encrypted) inside the OAuth state. */
interface FlowSecret {
  codeVerifier: string;
  clientId: string;
  clientSecret?: string;
  tokenEndpoint: string;
  mcpUrl: string;
  redirectUri: string;
}

export type StartResult =
  | { mode: 'oauth'; authorizeUrl: string }
  | { mode: 'apikey' }
  | { mode: 'none'; connected: true };

/**
 * Orchestrates connecting a directory entry: starts the OAuth flow (MCP-native
 * DCR+PKCE or env-credential PKCE), handles the redirect callback, and persists
 * the resulting connection so RemoteMcpAdapter can serve its tools. Apikey/none
 * entries are persisted directly.
 *
 * Governance is shared with the catalog flow (OAuthService.authorizeTier): a
 * directory entry whose slug is a catalog id (`notion`) obeys the workspace
 * allow-list, so a blocked connector can no longer be connected through the
 * directory. Callback failures redirect with `?error=<CODE>&provider=<slug>`.
 */
@Injectable()
export class DirectoryConnectService {
  private readonly logger = new Logger(DirectoryConnectService.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly vault: TokenVaultService,
    private readonly mcpOAuth: McpOAuthService,
    private readonly directory: DirectoryService,
    private readonly oauth: OAuthService,
    private readonly store: ConnectionStoreService,
    private readonly audit: AuditService,
  ) {}

  // ── Start ────────────────────────────────────────────────────────────────

  async start(slug: string, user: JwtUser): Promise<StartResult> {
    const entry = await this.requireEntry(slug);
    const scope = await this.oauth.authorizeTier(entry.tier, entry.slug, user);

    switch (entry.authMode) {
      case 'mcp-oauth':
        return { mode: 'oauth', authorizeUrl: await this.startMcpOAuth(entry, user, scope) };
      case 'env-oauth':
        return { mode: 'oauth', authorizeUrl: await this.startEnvOAuth(entry, user, scope) };
      case 'apikey':
        return { mode: 'apikey' };
      case 'none':
        await this.persistNoAuth(entry, user.sub, scope);
        return { mode: 'none', connected: true };
      default:
        throw new BadRequestException({ code: 'UNSUPPORTED_AUTH_MODE' });
    }
  }

  private async startMcpOAuth(
    entry: McpDirectoryEntryDocument,
    user: JwtUser,
    scope: ConnectionScope,
  ): Promise<string> {
    const redirectUri = this.redirectUri(entry.slug);
    const meta = await this.mcpOAuth.discoverMetadata(entry.mcpUrl);
    if (!meta.registrationEndpoint) {
      // Configure the entry as env-oauth instead.
      throw new OAuthFlowError('DCR_UNSUPPORTED');
    }
    const scopes = entry.scopes?.length ? entry.scopes : (meta.scopesSupported ?? []);
    const client = await this.mcpOAuth.registerClient(meta.registrationEndpoint, redirectUri, scopes);
    return this.buildAndSign(entry, user, scope, {
      authorizationEndpoint: meta.authorizationEndpoint,
      tokenEndpoint: meta.tokenEndpoint,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      redirectUri,
      scopes,
    });
  }

  private async startEnvOAuth(
    entry: McpDirectoryEntryDocument,
    user: JwtUser,
    scope: ConnectionScope,
  ): Promise<string> {
    // Re-validated at use time: entries saved before the env-name allow-list
    // existed must not be able to read arbitrary server env vars.
    await assertDirectoryEntrySafe(entry);
    const clientId = process.env[entry.envClientIdName!];
    const clientSecret = entry.envClientSecretName ? process.env[entry.envClientSecretName] : undefined;
    if (!clientId) {
      throw new BadRequestException({ code: 'ENV_OAUTH_NOT_CONFIGURED' });
    }
    return this.buildAndSign(entry, user, scope, {
      authorizationEndpoint: entry.authorizeUrl!,
      tokenEndpoint: entry.tokenUrl!,
      clientId,
      clientSecret,
      redirectUri: this.redirectUri(entry.slug),
      scopes: entry.scopes ?? [],
    });
  }

  /** Shared PKCE + state-signing + authorize-url build for both OAuth modes. */
  private buildAndSign(
    entry: McpDirectoryEntryDocument,
    user: JwtUser,
    scope: ConnectionScope,
    p: {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      clientId: string;
      clientSecret?: string;
      redirectUri: string;
      scopes: string[];
    },
  ): string {
    const pkce = this.mcpOAuth.generatePkce();
    const secret: FlowSecret = {
      codeVerifier: pkce.verifier,
      clientId: p.clientId,
      clientSecret: p.clientSecret,
      tokenEndpoint: p.tokenEndpoint,
      mcpUrl: entry.mcpUrl,
      redirectUri: p.redirectUri,
    };
    const state = this.oauth.signState({
      userId: user.sub,
      provider: entry.slug,
      scope,
      enc: JSON.stringify(this.vault.encrypt(JSON.stringify(secret))),
    });
    return this.mcpOAuth.buildAuthorizeUrl({
      authorizationEndpoint: p.authorizationEndpoint,
      clientId: p.clientId,
      redirectUri: p.redirectUri,
      state,
      codeChallenge: pkce.challenge,
      scopes: p.scopes,
      resource: entry.mcpUrl,
    });
  }

  // ── Callback ───────────────────────────────────────────────────────────────

  /** Exchange (PKCE) + persist; returns the client redirect URL. Never throws. */
  async handleCallback(slug: string, code: string, state: string, error?: string): Promise<string> {
    try {
      const payload = this.oauth.verifyState(state);
      if (payload.provider !== slug) throw new OAuthFlowError('STATE_INVALID');
      if (error) return this.oauth.redirectError(providerErrorCode(String(error)), slug);
      if (!code || typeof code !== 'string') return this.oauth.redirectError('MISSING_CODE', slug);
      if (!payload.enc) throw new OAuthFlowError('STATE_INVALID');

      let secret: FlowSecret;
      try {
        secret = JSON.parse(this.vault.decrypt(JSON.parse(payload.enc))) as FlowSecret;
      } catch {
        throw new OAuthFlowError('STATE_INVALID');
      }
      await this.requireEntry(slug);
      const scope: ConnectionScope = payload.scope === 'workspace' ? 'workspace' : 'personal';
      await this.oauth.recheckAtCallback(payload.userId, slug, scope);

      const tokens = await this.mcpOAuth.exchangeCode({
        tokenEndpoint: secret.tokenEndpoint,
        clientId: secret.clientId,
        clientSecret: secret.clientSecret,
        code,
        codeVerifier: secret.codeVerifier,
        redirectUri: secret.redirectUri,
        resource: secret.mcpUrl,
      });
      await this.persistTokens(slug, payload.userId, scope, secret, tokens);
      await this.auditConnect(payload.userId, slug, scope);
      return this.oauth.redirectConnected(slug);
    } catch (err) {
      const code = callbackErrorCode(err);
      if (code === 'INTERNAL_ERROR') {
        this.logger.error(`Directory OAuth callback for ${slug} failed`, err as Error);
      }
      return this.oauth.redirectError(code, slug);
    }
  }

  // ── Apikey connect ───────────────────────────────────────────────────────

  async connectWithKey(slug: string, user: JwtUser, credential: string): Promise<{ connected: true }> {
    const entry = await this.requireEntry(slug);
    if (entry.authMode !== 'apikey') {
      throw new BadRequestException({ code: 'NOT_AN_APIKEY_CONNECTOR' });
    }
    const scope = await this.oauth.authorizeTier(entry.tier, entry.slug, user);
    await this.store.upsert({
      userId: user.sub,
      provider: slug,
      scope,
      set: {
        scopes: entry.scopes ?? [],
        mcpUrl: entry.mcpUrl,
        directorySlug: slug,
        encryptedTokens: this.vault.encrypt(JSON.stringify({ access_token: credential })),
      },
      unset: ['tokenEndpoint', 'encryptedClientCreds', ...CATALOG_ONLY_FIELDS],
    });
    await this.auditConnect(user.sub, slug, scope);
    return { connected: true };
  }

  // ── Persistence helpers ────────────────────────────────────────────────────

  private async persistTokens(
    slug: string,
    userId: string,
    scope: ConnectionScope,
    secret: FlowSecret,
    tokens: McpTokenResponse,
  ): Promise<void> {
    await this.store.upsert({
      userId,
      provider: slug,
      scope,
      set: {
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        mcpUrl: secret.mcpUrl,
        tokenEndpoint: secret.tokenEndpoint,
        directorySlug: slug,
        encryptedTokens: this.vault.encrypt(JSON.stringify(tokens)),
        encryptedClientCreds: this.vault.encrypt(
          JSON.stringify({ client_id: secret.clientId, client_secret: secret.clientSecret }),
        ),
      },
      // A catalog connect of the same provider may have left its account label.
      unset: [...CATALOG_ONLY_FIELDS],
    });
  }

  private async persistNoAuth(
    entry: McpDirectoryEntryDocument,
    userId: string,
    scope: ConnectionScope,
  ): Promise<void> {
    await this.store.upsert({
      userId,
      provider: entry.slug,
      scope,
      set: {
        scopes: entry.scopes ?? [],
        mcpUrl: entry.mcpUrl,
        directorySlug: entry.slug,
        encryptedTokens: this.vault.encrypt(JSON.stringify({ access_token: '' })),
      },
      unset: [...DIRECTORY_ONLY_FIELDS.filter((f) => f !== 'directorySlug'), ...CATALOG_ONLY_FIELDS],
    });
    await this.auditConnect(userId, entry.slug, scope);
  }

  // ── Small helpers ──────────────────────────────────────────────────────────

  private async requireEntry(slug: string): Promise<McpDirectoryEntryDocument> {
    const entry = await this.directory.findBySlug(slug);
    if (!entry || !entry.available) {
      throw new NotFoundException({ code: 'CONNECTOR_UNAVAILABLE', provider: slug });
    }
    return entry;
  }

  private async auditConnect(userId: string, slug: string, scope: ConnectionScope): Promise<void> {
    if (scope !== 'workspace') return;
    await this.audit.record({
      actorId: userId,
      action: 'connector.connect',
      targetType: 'connector',
      targetId: slug,
      meta: { scope, directory: true },
    });
  }

  private redirectUri(slug: string): string {
    return `${this.cfg.get<string>('oauthRedirectBase')}/oauth/directory/${slug}/callback`;
  }
}
