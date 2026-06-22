import { createHash, randomBytes } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

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

/**
 * MCP-native OAuth protocol mechanics: metadata discovery
 * (`.well-known/oauth-protected-resource` → `oauth-authorization-server`),
 * Dynamic Client Registration (RFC 7591), PKCE (RFC 7636), and the
 * authorize-URL / token-exchange builders. Stateless and side-effect free
 * apart from outbound `fetch`; orchestration + persistence live in
 * OAuthService. Kept separate so oauth.service.ts stays under the size limit.
 */
@Injectable()
export class McpOAuthService {
  private readonly logger = new Logger(McpOAuthService.name);

  // ── Discovery ──────────────────────────────────────────────────────────────

  /**
   * Resolve the authorization-server metadata for a remote MCP server. Tries
   * the protected-resource document first (RFC 9728) to find the auth server,
   * then the AS metadata (RFC 8414); falls back to treating the MCP origin as
   * the auth server when the protected-resource doc is absent.
   */
  async discoverMetadata(mcpUrl: string): Promise<AsMetadata> {
    const origin = new URL(mcpUrl).origin;

    let issuer = origin;
    const prm = await this.fetchJson(
      `${origin}/.well-known/oauth-protected-resource`,
    ).catch(() => null);
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
      throw new BadRequestException(
        `No OAuth authorization-server metadata for ${mcpUrl}`,
      );
    }
    return meta;
  }

  private async fetchAsMetadata(url: string): Promise<AsMetadata | null> {
    const j = await this.fetchJson(url).catch(() => null);
    if (!j || !j.authorization_endpoint || !j.token_endpoint) return null;
    return {
      authorizationEndpoint: j.authorization_endpoint,
      tokenEndpoint: j.token_endpoint,
      registrationEndpoint: j.registration_endpoint,
      scopesSupported: j.scopes_supported,
    };
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return res.json();
  }

  // ── Dynamic Client Registration (RFC 7591) ──────────────────────────────────

  /**
   * Register a public OAuth client (PKCE, no secret) at the AS registration
   * endpoint. Returns the issued client_id (+ optional secret if the server
   * insists on a confidential client).
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

    const res = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Dynamic client registration failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const j = (await res.json()) as { client_id?: string; client_secret?: string };
    if (!j.client_id) {
      throw new BadRequestException('DCR response missing client_id');
    }
    return { clientId: j.client_id, clientSecret: j.client_secret };
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

  private async postToken(
    tokenEndpoint: string,
    form: Record<string, string>,
  ): Promise<McpTokenResponse> {
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(form).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Token exchange failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const tokens = (await res.json()) as McpTokenResponse;
    if (typeof tokens.expires_in === 'number' && !tokens.expiry_date) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
    }
    return tokens;
  }
}
