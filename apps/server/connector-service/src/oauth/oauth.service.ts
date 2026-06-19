import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CatalogEntry, findCatalogEntry } from '../catalog/catalog';
import { TokenVaultService } from '../vault/token-vault.service';
import {
  UserConnection,
  UserConnectionDocument,
} from '../connections/schemas/user-connection.schema';

export interface OAuthStatePayload {
  userId: string;
  provider: string;
  nonce?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
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

  startAuthorization(provider: string, userId: string): { authorizeUrl: string } {
    const entry = this.requireOAuthEntry(provider);
    const state = this.signState({ userId, provider });
    return { authorizeUrl: this.buildAuthorizeUrl(entry, state) };
  }

  buildAuthorizeUrl(entry: CatalogEntry, state: string): string {
    const url = new URL(entry.oauth!.authorizeUrl);
    url.searchParams.set('client_id', process.env[entry.oauth!.clientIdEnv] ?? '');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('owner', 'user');
    url.searchParams.set('redirect_uri', this.redirectUri(entry.id));
    url.searchParams.set('state', state);
    return url.toString();
  }

  private redirectUri(provider: string): string {
    const base = this.cfg.get<string>('oauthRedirectBase');
    return `${base}/oauth/${provider}/callback`;
  }

  // ── Code exchange ─────────────────────────────────────────────────────────

  async exchangeCode(entry: CatalogEntry, code: string): Promise<TokenResponse> {
    const clientId = process.env[entry.oauth!.clientIdEnv] ?? '';
    const clientSecret = process.env[entry.oauth!.clientSecretEnv] ?? '';
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(entry.oauth!.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(entry.id),
      }),
    });

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
  ): Promise<void> {
    const blob = this.vault.encrypt(JSON.stringify(tokens));
    const accountLabel =
      tokens.workspace_name ?? tokens.owner?.user?.name ?? undefined;
    const scopes = tokens.scope ? tokens.scope.split(' ') : entry.scopes;

    await this.connModel.updateOne(
      { userId, provider },
      {
        $set: {
          status: 'active',
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
    await this.persist(payload.userId, provider, tokens, entry);
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
