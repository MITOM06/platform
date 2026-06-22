import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
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
import {
  Capability,
  JwtUser,
  Workspace,
  WorkspaceDocument,
} from '@platform/database';
import { CatalogEntry, findCatalogEntry } from '../catalog/catalog';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditService } from '../audit/audit.service';
import {
  ConnectionScope,
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';

export interface OAuthStatePayload {
  userId: string;
  provider: string;
  scope?: ConnectionScope;
  nonce?: string;
  /**
   * Directory (MCP-native) flows only: vault-encrypted JSON blob carrying the
   * PKCE code_verifier + DCR client creds + token endpoint. Encrypted (not just
   * HMAC-signed) so the code_verifier is never exposed to the browser. See
   * DirectoryConnectService.
   */
  enc?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  /** Seconds until the access token expires (Google). */
  expires_in?: number;
  /** Absolute expiry epoch-ms, computed at persist time (Google refresh). */
  expiry_date?: number;
  // Notion returns the workspace/bot account info on the token response.
  workspace_name?: string;
  owner?: { user?: { name?: string } };
  scope?: string;
  [k: string]: unknown;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly vault: TokenVaultService,
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    private readonly audit: AuditService,
  ) {}

  // ── State signing (HMAC-sha256 with INTERNAL_API_KEY) ─────────────────────

  signState(payload: OAuthStatePayload): string {
    const body = {
      ...payload,
      nonce: payload.nonce ?? randomBytes(8).toString('hex'),
    };
    const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
    return `${encoded}.${this.hmac(encoded)}`;
  }

  verifyState(state: string): OAuthStatePayload {
    const [encoded, sig] = (state ?? '').split('.');
    if (!encoded || !sig) {
      throw new BadRequestException('Malformed OAuth state');
    }
    const expected = this.hmac(encoded);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid OAuth state signature');
    }
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Corrupt OAuth state payload');
    }
  }

  private hmac(data: string): string {
    const secret = this.cfg.get<string>('internalApiKey') ?? '';
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  // ── Authorize URL ─────────────────────────────────────────────────────────

  async startAuthorization(
    provider: string,
    user: JwtUser,
  ): Promise<{ authorizeUrl: string }> {
    const entry = this.requireOAuthEntry(provider);
    const scope = await this.authorizeConnect(entry, user);
    const state = this.signState({ userId: user.sub, provider, scope });
    return { authorizeUrl: this.buildAuthorizeUrl(entry, state) };
  }

  /**
   * Decide whether `user` may connect `entry` and which scope the resulting
   * connection takes. Workspace-tier connectors need CONNECT_WORKSPACE_CONNECTOR;
   * personal-tier (or 'both') need CONNECT_PERSONAL_CONNECTOR AND the provider
   * being present in the workspace allow-list. Throws ForbiddenException on deny.
   */
  private async authorizeConnect(
    entry: CatalogEntry,
    user: JwtUser,
  ): Promise<ConnectionScope> {
    return this.authorizeTier(entry.tier, entry.id, user);
  }

  /**
   * Decide scope + permission for connecting a connector of a given tier.
   * Shared by the static catalog flow and the dynamic directory flow.
   * Workspace-tier needs CONNECT_WORKSPACE_CONNECTOR; personal/both need
   * CONNECT_PERSONAL_CONNECTOR AND the provider being in the workspace
   * allow-list. Throws ForbiddenException on deny.
   */
  async authorizeTier(
    tier: 'workspace' | 'personal' | 'both',
    providerId: string,
    user: JwtUser,
  ): Promise<ConnectionScope> {
    const perms = new Set(user.perms ?? []);

    if (tier === 'workspace') {
      if (!perms.has(Capability.CONNECT_WORKSPACE_CONNECTOR)) {
        throw new ForbiddenException({
          code: 'INSUFFICIENT_PERMISSION',
          required: Capability.CONNECT_WORKSPACE_CONNECTOR,
        });
      }
      return 'workspace';
    }

    // personal | both -> personal connect flow
    if (!perms.has(Capability.CONNECT_PERSONAL_CONNECTOR)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        required: Capability.CONNECT_PERSONAL_CONNECTOR,
      });
    }
    const allowList = await this.connectorAllowList();
    if (!allowList.includes(providerId)) {
      throw new ForbiddenException({
        code: 'CONNECTOR_NOT_ALLOWED',
        provider: providerId,
      });
    }
    return 'personal';
  }

  private async connectorAllowList(): Promise<string[]> {
    const ws = await this.workspaceModel.findOne().lean();
    return ws?.connectorAllowList ?? [];
  }

  buildAuthorizeUrl(entry: CatalogEntry, state: string): string {
    const cfg = entry.oauth!;
    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set('client_id', process.env[cfg.clientIdEnv] ?? '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri(entry.id));
    url.searchParams.set('state', state);
    if (cfg.ownerParam) url.searchParams.set('owner', 'user');
    if (cfg.includeScope && entry.scopes.length) {
      url.searchParams.set('scope', entry.scopes.join(' '));
    }
    for (const [k, v] of Object.entries(cfg.extraAuthorizeParams ?? {})) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  }

  private redirectUri(provider: string): string {
    const base = this.cfg.get<string>('oauthRedirectBase');
    return `${base}/oauth/${provider}/callback`;
  }

  // ── Code exchange ─────────────────────────────────────────────────────────

  async exchangeCode(entry: CatalogEntry, code: string): Promise<TokenResponse> {
    const cfg = entry.oauth!;
    const clientId = process.env[cfg.clientIdEnv] ?? '';
    const clientSecret = process.env[cfg.clientSecretEnv] ?? '';
    const redirectUri = this.redirectUri(entry.id);
    const authStyle = cfg.authStyle ?? 'basic';
    const bodyFormat = cfg.bodyFormat ?? 'json';

    const headers: Record<string, string> = { Accept: 'application/json' };
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };
    // 'body' auth style carries the client credentials in the request body
    // (Google); 'basic' uses the Authorization header (Notion).
    if (authStyle === 'body') {
      params.client_id = clientId;
      params.client_secret = clientSecret;
    } else {
      headers.Authorization = `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`,
      ).toString('base64')}`;
    }

    let body: string;
    if (bodyFormat === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(params).toString();
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(params);
    }

    const res = await fetch(cfg.tokenUrl, { method: 'POST', headers, body });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `OAuth token exchange failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as TokenResponse;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  async persist(
    userId: string,
    provider: string,
    tokens: TokenResponse,
    entry: CatalogEntry,
    scope: ConnectionScope = 'personal',
  ): Promise<void> {
    // Compute an absolute expiry so adapters can pre-emptively refresh Google
    // access tokens (harmless for providers without `expires_in`, e.g. Notion).
    if (typeof tokens.expires_in === 'number' && !tokens.expiry_date) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
    }
    const blob = this.vault.encrypt(JSON.stringify(tokens));
    const accountLabel =
      tokens.workspace_name ?? tokens.owner?.user?.name ?? undefined;
    const scopes = tokens.scope ? tokens.scope.split(' ') : entry.scopes;

    await this.connModel.updateOne(
      { userId, provider },
      {
        $set: {
          status: 'active',
          scope,
          scopes,
          mcpUrl: entry.mcpUrl,
          encryptedTokens: blob,
          ...(accountLabel ? { accountLabel } : {}),
        },
      },
      { upsert: true },
    );
  }

  // ── Callback orchestration ────────────────────────────────────────────────

  async handleCallback(provider: string, code: string, state: string): Promise<string> {
    const payload = this.verifyState(state);
    if (payload.provider !== provider) {
      throw new BadRequestException('State/provider mismatch');
    }
    const entry = this.requireOAuthEntry(provider);
    const tokens = await this.exchangeCode(entry, code);
    const scope = payload.scope ?? 'personal';
    await this.persist(payload.userId, provider, tokens, entry, scope);
    // Audit workspace-scoped connects (shared resource affecting every member).
    // Personal connects are the user's own and are not audit-logged.
    if (scope === 'workspace') {
      await this.audit.record({
        actorId: payload.userId,
        action: 'connector.connect',
        targetType: 'connector',
        targetId: provider,
        meta: { scope },
      });
    }
    const clientUrl = this.cfg.get<string>('clientRedirectUrl');
    const sep = clientUrl.includes('?') ? '&' : '?';
    return `${clientUrl}${sep}connected=${encodeURIComponent(provider)}`;
  }

  private requireOAuthEntry(provider: string): CatalogEntry {
    const entry = findCatalogEntry(provider);
    if (!entry || !entry.available) {
      throw new NotFoundException(`Unknown connector: ${provider}`);
    }
    if (entry.authType !== 'oauth2' || !entry.oauth) {
      throw new BadRequestException(`Connector ${provider} does not use OAuth`);
    }
    return entry;
  }
}
