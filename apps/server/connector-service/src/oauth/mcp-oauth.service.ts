import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { redactUrl } from '../common/redact';
import { assertSafeUrl, checkUrlSyntax, safeFetch } from '../security/url-guard';
import { OAuthFlowError, parseOAuthErrorCode, TokenEndpointError } from './oauth-errors';

/** OAuth Authorization Server metadata fields we rely on (RFC 8414). */
export interface AsMetadata {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  scopesSupported?: string[];
}

export interface DcrClient {
  clientId: string;
  clientSecret?: string;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface McpTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
  [k: string]: unknown;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * MCP-native OAuth protocol mechanics: metadata discovery
 * (`.well-known/oauth-protected-resource` → `oauth-authorization-server`),
 * Dynamic Client Registration (RFC 7591), PKCE (RFC 7636), and the
 * authorize-URL / token-exchange builders. Stateless apart from outbound
 * requests; orchestration + persistence live in DirectoryConnectService.
 *
 * Every outbound request goes through the SSRF guard, and endpoints learned
 * from remote metadata are re-validated before use — a hostile server cannot
 * point the issuer, registration or token endpoint at an internal host.
 * Failures surface as coded {@link OAuthFlowError}s; upstream bodies are only
 * logged (truncated), never echoed to the caller.
 */
@Injectable()
export class McpOAuthService {
  private readonly logger = new Logger(McpOAuthService.name);

  // ── Discovery ──────────────────────────────────────────────────────────────

  async discoverMetadata(mcpUrl: string): Promise<AsMetadata> {
    const origin = (await assertSafeUrl(mcpUrl)).origin;

    let issuer = origin;
    const prm = await this.fetchJson(`${origin}/.well-known/oauth-protected-resource`).catch(() => null);
    const servers = prm?.authorization_servers;
    if (Array.isArray(servers) && servers.length && typeof servers[0] === 'string') {
      issuer = servers[0].replace(/\/$/, '');
    }

    const meta =
      (await this.fetchAsMetadata(`${issuer}/.well-known/oauth-authorization-server`)) ??
      (await this.fetchAsMetadata(`${issuer}/.well-known/openid-configuration`)) ??
      (issuer !== origin
        ? await this.fetchAsMetadata(`${origin}/.well-known/oauth-authorization-server`)
        : null);

    if (!meta) {
      this.logger.warn(`No OAuth AS metadata for ${redactUrl(mcpUrl)}`);
      throw new OAuthFlowError('OAUTH_DISCOVERY_FAILED');
    }
    // Endpoints from a remote document: the browser is sent to the authorize
    // endpoint (https only); we POST to the token/registration endpoints.
    try {
      checkUrlSyntax(meta.authorizationEndpoint);
      await assertSafeUrl(meta.tokenEndpoint);
      if (meta.registrationEndpoint) await assertSafeUrl(meta.registrationEndpoint);
    } catch (err) {
      this.logger.warn(
        `Rejected OAuth metadata endpoints for ${redactUrl(mcpUrl)}: ${(err as { reason?: string }).reason ?? (err as Error).message}`,
      );
      throw new OAuthFlowError('OAUTH_DISCOVERY_FAILED', { reason: 'unsafe endpoint' });
    }
    return meta;
  }

  private async fetchAsMetadata(url: string): Promise<AsMetadata | null> {
    const j = await this.fetchJson(url).catch(() => null);
    if (!j || typeof j.authorization_endpoint !== 'string' || typeof j.token_endpoint !== 'string') {
      return null;
    }
    return {
      authorizationEndpoint: j.authorization_endpoint,
      tokenEndpoint: j.token_endpoint,
      registrationEndpoint: typeof j.registration_endpoint === 'string' ? j.registration_endpoint : undefined,
      scopesSupported: Array.isArray(j.scopes_supported) ? j.scopes_supported : undefined,
    };
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await safeFetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`metadata fetch -> ${res.status}`);
    return res.json();
  }

  // ── Dynamic Client Registration (RFC 7591) ──────────────────────────────────

  /**
   * Register a public OAuth client (PKCE, no secret). Returns the issued
   * client_id (+ a secret if the server insists on a confidential client).
   */
  async registerClient(
    registrationEndpoint: string,
    redirectUri: string,
    scopes: string[],
  ): Promise<DcrClient> {
    const body: Record<string, unknown> = {
      client_name: 'PON Connector',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
    if (scopes.length) body.scope = scopes.join(' ');

    const res = await safeFetch(registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(
        `DCR failed at ${redactUrl(registrationEndpoint)} (${res.status}): ${text.slice(0, 200)}`,
      );
      throw new OAuthFlowError('DCR_FAILED', { status: res.status });
    }
    const j = (await res.json().catch(() => ({}))) as { client_id?: unknown; client_secret?: unknown };
    if (typeof j.client_id !== 'string' || !j.client_id) {
      throw new OAuthFlowError('DCR_FAILED', { reason: 'missing client_id' });
    }
    return {
      clientId: j.client_id,
      clientSecret: typeof j.client_secret === 'string' ? j.client_secret : undefined,
    };
  }

  // ── PKCE (RFC 7636) ──────────────────────────────────────────────────────────

  generatePkce(): PkcePair {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  // ── Authorize URL ────────────────────────────────────────────────────────────

  buildAuthorizeUrl(params: {
    authorizationEndpoint: string;
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scopes: string[];
    resource: string;
  }): string {
    const url = new URL(params.authorizationEndpoint);
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    // RFC 8707 resource indicator — MCP servers bind tokens to their own URL.
    url.searchParams.set('resource', params.resource);
    if (params.scopes.length) url.searchParams.set('scope', params.scopes.join(' '));
    return url.toString();
  }

  // ── Token exchange ───────────────────────────────────────────────────────────

  async exchangeCode(params: {
    tokenEndpoint: string;
    clientId: string;
    clientSecret?: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
    resource: string;
  }): Promise<McpTokenResponse> {
    const form: Record<string, string> = {
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
      resource: params.resource,
    };
    if (params.clientSecret) form.client_secret = params.clientSecret;
    return this.postToken(params.tokenEndpoint, form);
  }

  async refresh(params: {
    tokenEndpoint: string;
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
    resource: string;
  }): Promise<McpTokenResponse> {
    const form: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      resource: params.resource,
    };
    if (params.clientSecret) form.client_secret = params.clientSecret;
    return this.postToken(params.tokenEndpoint, form);
  }

  private async postToken(tokenEndpoint: string, form: Record<string, string>): Promise<McpTokenResponse> {
    const res = await safeFetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const oauthError = parseOAuthErrorCode(text);
      this.logger.warn(
        `Token endpoint ${redactUrl(tokenEndpoint)} answered ${res.status}${oauthError ? ` (${oauthError})` : ''}: ${text.slice(0, 200)}`,
      );
      throw new TokenEndpointError(res.status, oauthError);
    }
    const tokens = (await res.json().catch(() => null)) as McpTokenResponse | null;
    if (!tokens || typeof tokens.access_token !== 'string') {
      throw new TokenEndpointError(res.status, 'invalid_response');
    }
    if (typeof tokens.expires_in === 'number' && !tokens.expiry_date) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
    }
    return tokens;
  }
}
