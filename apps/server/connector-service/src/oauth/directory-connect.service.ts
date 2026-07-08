import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Capability, JwtUser } from '@platform/database';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditService } from '../audit/audit.service';
import { DirectoryService } from '../directory/directory.service';
import { McpDirectoryEntryDocument } from '../connections/schemas/mcp-directory-entry.schema';
import {
  ConnectionScope,
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';
import { OAuthService } from './oauth.service';
import { McpOAuthService, McpTokenResponse } from './mcp-oauth.service';

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
 * entries are persisted directly. Kept separate from OAuthService (static
 * catalog) to respect the file-size limit and single responsibility.
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
    private readonly audit: AuditService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
  ) {}

  // ── Start ────────────────────────────────────────────────────────────────

  async start(slug: string, user: JwtUser): Promise<StartResult> {
    const entry = await this.requireEntry(slug);
    const scope = this.authorize(entry, user);

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
        throw new BadRequestException(`Unsupported authMode: ${entry.authMode}`);
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
      throw new BadRequestException(
        `${entry.name} does not support dynamic client registration; configure it as env-oauth instead`,
      );
    }
    const scopes = entry.scopes?.length ? entry.scopes : meta.scopesSupported ?? [];
    const client = await this.mcpOAuth.registerClient(
      meta.registrationEndpoint,
      redirectUri,
      scopes,
    );
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
    const clientId = entry.envClientIdName ? process.env[entry.envClientIdName] : '';
    const clientSecret = entry.envClientSecretName
      ? process.env[entry.envClientSecretName]
      : undefined;
    if (!clientId || !entry.authorizeUrl || !entry.tokenUrl) {
      throw new BadRequestException(
        `${entry.name} is missing env-oauth configuration (client id / authorize / token url)`,
      );
    }
    return this.buildAndSign(entry, user, scope, {
      authorizationEndpoint: entry.authorizeUrl,
      tokenEndpoint: entry.tokenUrl,
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

  async handleCallback(
    slug: string,
    code: string,
    state: string,
    error?: string,
  ): Promise<string> {
    const payload = this.oauth.verifyState(state);
    if (payload.provider !== slug) {
      throw new BadRequestException('State/provider mismatch');
    }
    // Provider-side denial or a missing code: bounce to the client with an
    // error code instead of throwing a raw body the browser renders as JSON
    // (.claude/rules/no-raw-system-data-in-ui.md).
    if (error || !code) {
      return this.clientRedirect('error', error ?? 'missing_code');
    }
    if (!payload.enc) {
      throw new BadRequestException('Missing OAuth flow secret');
    }
    const secret = JSON.parse(
      this.vault.decrypt(JSON.parse(payload.enc)),
    ) as FlowSecret;

    const tokens = await this.mcpOAuth.exchangeCode({
      tokenEndpoint: secret.tokenEndpoint,
      clientId: secret.clientId,
      clientSecret: secret.clientSecret,
      code,
      codeVerifier: secret.codeVerifier,
      redirectUri: secret.redirectUri,
      resource: secret.mcpUrl,
    });

    const scope = payload.scope ?? 'personal';
    await this.persistTokens(slug, payload.userId, scope, secret, tokens);
    await this.auditConnect(payload.userId, slug, scope);
    return this.clientRedirect('connected', slug);
  }

  // ── Apikey connect ───────────────────────────────────────────────────────

  async connectWithKey(
    slug: string,
    user: JwtUser,
    credential: string,
  ): Promise<{ connected: true }> {
    const entry = await this.requireEntry(slug);
    if (entry.authMode !== 'apikey') {
      throw new BadRequestException(`${entry.name} does not use an API key`);
    }
    const scope = this.authorize(entry, user);
    await this.connModel.updateOne(
      { userId: user.sub, provider: slug },
      {
        $set: {
          status: 'active',
          scope,
          scopes: entry.scopes ?? [],
          mcpUrl: entry.mcpUrl,
          directorySlug: slug,
          encryptedTokens: this.vault.encrypt(
            JSON.stringify({ access_token: credential }),
          ),
        },
      },
      { upsert: true },
    );
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
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];
    await this.connModel.updateOne(
      { userId, provider: slug },
      {
        $set: {
          status: 'active',
          scope,
          scopes,
          mcpUrl: secret.mcpUrl,
          tokenEndpoint: secret.tokenEndpoint,
          directorySlug: slug,
          encryptedTokens: this.vault.encrypt(JSON.stringify(tokens)),
          encryptedClientCreds: this.vault.encrypt(
            JSON.stringify({
              client_id: secret.clientId,
              client_secret: secret.clientSecret,
            }),
          ),
        },
      },
      { upsert: true },
    );
  }

  private async persistNoAuth(
    entry: McpDirectoryEntryDocument,
    userId: string,
    scope: ConnectionScope,
  ): Promise<void> {
    await this.connModel.updateOne(
      { userId, provider: entry.slug },
      {
        $set: {
          status: 'active',
          scope,
          scopes: entry.scopes ?? [],
          mcpUrl: entry.mcpUrl,
          directorySlug: entry.slug,
          encryptedTokens: this.vault.encrypt(
            JSON.stringify({ access_token: '' }),
          ),
        },
      },
      { upsert: true },
    );
    await this.auditConnect(userId, entry.slug, scope);
  }

  // ── Small helpers ──────────────────────────────────────────────────────────

  private async requireEntry(slug: string): Promise<McpDirectoryEntryDocument> {
    const entry = await this.directory.findBySlug(slug);
    if (!entry || !entry.available) {
      throw new NotFoundException(`Unknown directory entry: ${slug}`);
    }
    return entry;
  }

  /** Capability-only authorization by tier — the directory entry's presence is
   *  itself the allow-list, so the legacy workspace allow-list is not applied. */
  private authorize(
    entry: McpDirectoryEntryDocument,
    user: JwtUser,
  ): ConnectionScope {
    const perms = new Set(user.perms ?? []);
    if (entry.tier === 'workspace') {
      if (!perms.has(Capability.CONNECT_WORKSPACE_CONNECTOR)) {
        throw new ForbiddenException({
          code: 'INSUFFICIENT_PERMISSION',
          required: Capability.CONNECT_WORKSPACE_CONNECTOR,
        });
      }
      return 'workspace';
    }
    if (!perms.has(Capability.CONNECT_PERSONAL_CONNECTOR)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        required: Capability.CONNECT_PERSONAL_CONNECTOR,
      });
    }
    return 'personal';
  }

  private async auditConnect(
    userId: string,
    slug: string,
    scope: ConnectionScope,
  ): Promise<void> {
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
    const base = this.cfg.get<string>('oauthRedirectBase');
    return `${base}/oauth/directory/${slug}/callback`;
  }

  private clientRedirect(param: 'connected' | 'error', value: string): string {
    const clientUrl = this.cfg.get<string>('clientRedirectUrl') ?? '';
    const sep = clientUrl.includes('?') ? '&' : '?';
    return `${clientUrl}${sep}${param}=${encodeURIComponent(value)}`;
  }
}
