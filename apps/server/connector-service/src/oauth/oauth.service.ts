import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Capability, JwtUser } from '@platform/database';
import { CatalogEntry, findCatalogEntry } from '../catalog/catalog';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditService } from '../audit/audit.service';
import { ConnectionScope } from '../connections/schemas/user-connection.schema';
import {
  CATALOG_ONLY_FIELDS,
  ConnectionStoreService,
  DIRECTORY_ONLY_FIELDS,
} from '../connections/connection-store.service';
import { ConnectorPolicyService } from '../governance/connector-policy.service';
import { PermResolverService } from '../internal/perm-resolver.service';
import {
  buildClientRedirect,
  callbackErrorCode,
  OAuthCallbackErrorCode,
  OAuthFlowError,
  parseOAuthErrorCode,
  providerErrorCode,
  TokenEndpointError,
} from './oauth-errors';

export interface OAuthStatePayload {
  userId: string;
  provider: string;
  scope?: ConnectionScope;
  nonce?: string;
  /** Issued-at epoch-ms; used to reject stale states (see STATE_TTL_MS). */
  iat?: number;
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

type Tier = 'workspace' | 'personal' | 'both';

/**
 * Static-catalog OAuth (Notion/Google): state signing, authorization, token
 * exchange and persistence. Also hosts the connect-authorization rules shared
 * with the dynamic directory flow.
 *
 * Callbacks never throw: every failure redirects the popup to
 * `CLIENT_REDIRECT_URL?error=<CODE>&provider=<slug>` (codes in oauth-errors.ts),
 * so a raw `{"message": ...}` body can never be rendered in the browser.
 *
 * The signed state is bound to the member and provider, carries a 10-minute
 * TTL and is re-validated at the callback (member still active, capability
 * still held, connector still allowed). It is NOT bound to the browser that
 * started the flow: the start call is an XHR from the web app (third-party
 * cookie context in the Vercel + tunnel deployment) or a Dio call from the
 * mobile app (no browser cookie jar at all), so a binding cookie cannot be set
 * without client changes.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  /** A signed OAuth state is only valid for 10 minutes (replay/stale window). */
  private static readonly STATE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly cfg: ConfigService,
    private readonly vault: TokenVaultService,
    private readonly store: ConnectionStoreService,
    private readonly policy: ConnectorPolicyService,
    private readonly perms: PermResolverService,
    private readonly audit: AuditService,
  ) {}

  // ── State signing (HMAC-sha256 with INTERNAL_API_KEY) ─────────────────────

  signState(payload: OAuthStatePayload): string {
    const body = {
      ...payload,
      nonce: payload.nonce ?? randomBytes(8).toString('hex'),
      iat: payload.iat ?? Date.now(),
    };
    const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
    return `${encoded}.${this.hmac(encoded)}`;
  }

  verifyState(state: string): OAuthStatePayload {
    const [encoded, sig] = String(state ?? '').split('.');
    if (!encoded || !sig) throw new OAuthFlowError('STATE_INVALID');
    const a = Buffer.from(sig);
    const b = Buffer.from(this.hmac(encoded));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new OAuthFlowError('STATE_INVALID');
    }
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
    } catch {
      throw new OAuthFlowError('STATE_INVALID');
    }
    if (!payload || typeof payload.userId !== 'string' || typeof payload.provider !== 'string') {
      throw new OAuthFlowError('STATE_INVALID');
    }
    // Reject stale states so a leaked/paused authorize URL can't be replayed.
    if (typeof payload.iat !== 'number' || Date.now() - payload.iat > OAuthService.STATE_TTL_MS) {
      throw new OAuthFlowError('STATE_EXPIRED');
    }
    return payload;
  }

  private hmac(data: string): string {
    const secret = this.cfg.get<string>('internalApiKey') ?? '';
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  // ── Authorization ─────────────────────────────────────────────────────────

  async startAuthorization(provider: string, user: JwtUser): Promise<{ authorizeUrl: string }> {
    const entry = this.requireOAuthEntry(provider);
    const scope = await this.authorizeTier(entry.tier, entry.id, user);
    const state = this.signState({ userId: user.sub, provider, scope });
    return { authorizeUrl: this.buildAuthorizeUrl(entry, state) };
  }

  /**
   * Decide whether `user` may connect `providerId` and which scope the
   * connection takes. Shared by the catalog and the directory flows.
   * Workspace tier needs CONNECT_WORKSPACE_CONNECTOR; personal/both need
   * CONNECT_PERSONAL_CONNECTOR. Either way the workspace allow-list must allow
   * the provider. Throws 403 `INSUFFICIENT_PERMISSION` / `CONNECTOR_NOT_ALLOWED`.
   */
  async authorizeTier(tier: Tier, providerId: string, user: JwtUser): Promise<ConnectionScope> {
    const scope: ConnectionScope = tier === 'workspace' ? 'workspace' : 'personal';
    const required = OAuthService.requiredCapability(scope);
    if (!(user.perms ?? []).includes(required)) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION', required });
    }
    await this.policy.assertConnectAllowed(providerId);
    return scope;
  }

  /**
   * The callback is unauthenticated (identity comes from the signed state), so
   * re-check what may have changed since the flow started.
   */
  async recheckAtCallback(userId: string, providerId: string, scope: ConnectionScope): Promise<void> {
    const member = await this.perms.resolveMember(userId);
    if (!member.active || !member.perms.has(OAuthService.requiredCapability(scope))) {
      throw new OAuthFlowError('INSUFFICIENT_PERMISSION');
    }
    await this.policy.assertConnectAllowed(providerId);
  }

  private static requiredCapability(scope: ConnectionScope): Capability {
    return scope === 'workspace'
      ? Capability.CONNECT_WORKSPACE_CONNECTOR
      : Capability.CONNECT_PERSONAL_CONNECTOR;
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
    return `${this.cfg.get<string>('oauthRedirectBase')}/oauth/${provider}/callback`;
  }

  // ── Code exchange ─────────────────────────────────────────────────────────

  async exchangeCode(entry: CatalogEntry, code: string): Promise<TokenResponse> {
    const cfg = entry.oauth!;
    const clientId = process.env[cfg.clientIdEnv] ?? '';
    const clientSecret = process.env[cfg.clientSecretEnv] ?? '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(entry.id),
    };
    // 'body' auth style carries the client credentials in the request body
    // (Google); 'basic' uses the Authorization header (Notion).
    if ((cfg.authStyle ?? 'basic') === 'body') {
      params.client_id = clientId;
      params.client_secret = clientSecret;
    } else {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }
    let body: string;
    if ((cfg.bodyFormat ?? 'json') === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(params).toString();
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(params);
    }

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const oauthError = parseOAuthErrorCode(text);
      this.logger.warn(`${entry.id} token exchange failed (${res.status}): ${text.slice(0, 200)}`);
      throw new TokenEndpointError(res.status, oauthError);
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
    // Absolute expiry so adapters can pre-emptively refresh Google tokens
    // (harmless for providers without `expires_in`, e.g. Notion).
    if (typeof tokens.expires_in === 'number' && !tokens.expiry_date) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
    }
    const accountLabel = tokens.workspace_name ?? tokens.owner?.user?.name ?? undefined;
    await this.store.upsert({
      userId,
      provider,
      scope,
      set: {
        scopes: tokens.scope ? tokens.scope.split(' ') : entry.scopes,
        mcpUrl: entry.mcpUrl,
        encryptedTokens: this.vault.encrypt(JSON.stringify(tokens)),
        ...(accountLabel ? { accountLabel } : {}),
      },
      // A directory connect may have left its refresh plumbing on this record.
      unset: [...DIRECTORY_ONLY_FIELDS, ...(accountLabel ? [] : CATALOG_ONLY_FIELDS)],
    });
  }

  // ── Callback orchestration ────────────────────────────────────────────────

  /** Exchange + persist; returns the client redirect URL. Never throws. */
  async handleCallback(provider: string, code: string, state: string, error?: string): Promise<string> {
    try {
      const payload = this.verifyState(state);
      if (payload.provider !== provider) throw new OAuthFlowError('STATE_INVALID');
      if (error) return this.redirectError(providerErrorCode(String(error)), provider);
      if (!code || typeof code !== 'string') return this.redirectError('MISSING_CODE', provider);
      const entry = this.requireOAuthEntry(provider);
      const scope = payload.scope === 'workspace' ? 'workspace' : 'personal';
      await this.recheckAtCallback(payload.userId, provider, scope);
      const tokens = await this.exchangeCode(entry, code);
      await this.persist(payload.userId, provider, tokens, entry, scope);
      // Workspace connects affect every member and are audited; personal
      // connects are the member's own and are not.
      if (scope === 'workspace') {
        await this.audit.record({
          actorId: payload.userId,
          action: 'connector.connect',
          targetType: 'connector',
          targetId: provider,
          meta: { scope },
        });
      }
      return this.redirectConnected(provider);
    } catch (err) {
      const code = callbackErrorCode(err);
      if (code === 'INTERNAL_ERROR') {
        this.logger.error(`OAuth callback for ${provider} failed`, err as Error);
      }
      return this.redirectError(code, provider);
    }
  }

  redirectConnected(provider: string): string {
    return buildClientRedirect(this.clientUrl(), { connected: provider });
  }

  redirectError(code: OAuthCallbackErrorCode, provider?: string): string {
    return buildClientRedirect(this.clientUrl(), { error: code, provider });
  }

  private clientUrl(): string {
    return this.cfg.get<string>('clientRedirectUrl') ?? '';
  }

  private requireOAuthEntry(provider: string): CatalogEntry {
    const entry = findCatalogEntry(provider);
    if (!entry || !entry.available || entry.authType !== 'oauth2' || !entry.oauth) {
      throw new NotFoundException({ code: 'CONNECTOR_UNAVAILABLE', provider });
    }
    return entry;
  }
}
