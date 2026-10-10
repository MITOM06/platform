/** Minimal config reader (ConfigService satisfies it). */
export interface ConfigReader {
  get<T = string>(key: string): T | undefined;
}

/**
 * Whether OIDC SSO is configured for this deployment by env: `OIDC_ENABLED`
 * true/1 plus an issuer and a client id. Without it the SSO button is hidden
 * and "Require SSO" cannot be switched on (nor does a stored switch apply).
 */
export function isOidcConfiguredByEnv(config: ConfigReader): boolean {
  const enabled = (config.get<string>('OIDC_ENABLED') || '').toLowerCase();
  return (
    (enabled === 'true' || enabled === '1') &&
    !!config.get<string>('OIDC_ISSUER') &&
    !!config.get<string>('OIDC_CLIENT_ID')
  );
}
