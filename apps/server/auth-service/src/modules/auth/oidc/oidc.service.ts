import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { Issuer, generators, Client } from 'openid-client';
import { AuthCode } from '../../../common/auth-code.enum';
import { isOidcConfiguredByEnv } from './oidc-env';

interface OidcFlow {
  codeVerifier: string;
  nonce: string;
  platform: string;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private clientPromise?: Promise<Client>;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  isEnabledByEnv(): boolean {
    return isOidcConfiguredByEnv(this.config);
  }

  private redirectUri(): string {
    const explicit = this.config.get<string>('OIDC_REDIRECT_URI');
    if (explicit) return explicit;
    const domain = this.config.get<string>('DOMAIN');
    return `https://${domain}/api/auth/oidc/callback`;
  }

  /**
   * The discovered OIDC client. A successful discovery is cached for the
   * process lifetime; a failed one (IdP down / unreachable) is NOT, so the
   * next request retries instead of failing until a restart. The failure
   * surfaces as 503 SSO_UNAVAILABLE (an `?error=` redirect at the endpoints).
   */
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      const attempt = (async () => {
        const issuer = await Issuer.discover(
          this.config.get<string>('OIDC_ISSUER')!,
        );
        return new issuer.Client({
          client_id: this.config.get<string>('OIDC_CLIENT_ID')!,
          client_secret: this.config.get<string>('OIDC_CLIENT_SECRET'),
          redirect_uris: [this.redirectUri()],
          response_types: ['code'],
        });
      })().catch((err: unknown) => {
        if (this.clientPromise === attempt) this.clientPromise = undefined;
        this.logger.warn(
          `OIDC discovery failed (retried on the next request): ${err instanceof Error ? err.message : typeof err}`,
        );
        throw new ServiceUnavailableException({
          code: AuthCode.SSO_UNAVAILABLE,
        });
      });
      this.clientPromise = attempt;
    }
    return this.clientPromise;
  }

  async buildAuthorizeUrl(platform: string): Promise<string> {
    const client = await this.getClient();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    const nonce = generators.nonce();
    const flow: OidcFlow = { codeVerifier, nonce, platform };
    await this.redis.set(`oidc:flow:${state}`, JSON.stringify(flow), 'EX', 600);
    return client.authorizationUrl({
      scope: this.config.get<string>('OIDC_SCOPES') || 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
  }

  async handleCallback(query: Record<string, any>): Promise<{
    email: string;
    displayName: string;
    id: string;
    groups: string[];
    platform: string;
  }> {
    const state = query?.state;
    if (!state) throw new UnauthorizedException({ code: 'OIDC_NO_STATE' });
    const key = `oidc:flow:${state}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new UnauthorizedException({ code: 'OIDC_BAD_STATE' });
    await this.redis.del(key); // one-time use

    const flow: OidcFlow = JSON.parse(raw);
    const client = await this.getClient();
    let tokenSet;
    try {
      tokenSet = await client.callback(this.redirectUri(), query, {
        state,
        nonce: flow.nonce,
        code_verifier: flow.codeVerifier,
      });
    } catch {
      throw new UnauthorizedException({ code: 'OIDC_EXCHANGE_FAILED' });
    }

    const claims: any = tokenSet.claims();
    if (!claims.email || claims.email_verified === false) {
      throw new UnauthorizedException({ code: 'OIDC_EMAIL_UNVERIFIED' });
    }
    const groupsClaim = this.config.get<string>('OIDC_GROUPS_CLAIM') || 'groups';
    const groups: string[] = Array.isArray(claims[groupsClaim])
      ? claims[groupsClaim]
      : [];
    return {
      email: claims.email,
      displayName: claims.name || claims.email.split('@')[0],
      id: claims.sub,
      groups,
      platform: flow.platform,
    };
  }
}
