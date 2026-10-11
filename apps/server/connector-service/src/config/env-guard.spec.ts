import { findEnvProblems, findEnvWarnings, resolveAllowedOrigins, DEV_ORIGINS } from './env-guard';

const PROD_ENV = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://user:pw@cluster.mongodb.net/platform',
  OAUTH_REDIRECT_BASE: 'https://api.pon.example/api/connector',
  CLIENT_REDIRECT_URL: 'https://web.pon.example/integrations',
  INTERNAL_API_KEY: 'internal-key',
  JWT_ACCESS_SECRET: 'jwt-secret',
};

describe('findEnvProblems', () => {
  it('accepts a fully-configured production environment', () => {
    expect(findEnvProblems(PROD_ENV)).toEqual([]);
  });

  it('rejects an address left pointing at this container', () => {
    const problems = findEnvProblems({
      ...PROD_ENV,
      MONGO_URI: 'mongodb://localhost:27018/platform',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('MONGO_URI');
  });

  // A self-host trial uses DOMAIN=localhost (.env.example's default): Caddy then
  // serves https://localhost with its local CA, and these two are browser-facing
  // URLs on that real https origin — not the http://localhost:300x dev defaults.
  it('accepts the https://localhost browser URLs of a local self-host install', () => {
    expect(
      findEnvProblems({
        ...PROD_ENV,
        OAUTH_REDIRECT_BASE: 'https://localhost/api/connector',
        CLIENT_REDIRECT_URL: 'https://localhost/integrations',
      }),
    ).toEqual([]);
  });

  it('still rejects the plain-http localhost dev defaults for the browser URLs', () => {
    const problems = findEnvProblems({
      ...PROD_ENV,
      OAUTH_REDIRECT_BASE: 'http://localhost:3003',
      CLIENT_REDIRECT_URL: 'http://localhost:3000/integrations',
    });
    expect(problems).toHaveLength(2);
  });

  it('rejects an unset address', () => {
    const problems = findEnvProblems({ ...PROD_ENV, OAUTH_REDIRECT_BASE: undefined });
    expect(problems).toEqual(['OAUTH_REDIRECT_BASE is unset']);
  });

  it('rejects a blank shared secret — the internal guard would compare against ""', () => {
    expect(findEnvProblems({ ...PROD_ENV, INTERNAL_API_KEY: '' })).toEqual([
      'INTERNAL_API_KEY is unset',
    ]);
  });
});

describe('MCP_SERVER_URL (optional Bot Factory bridge)', () => {
  // compose.prod.yml derives it from DOMAIN, so a localhost trial gets a
  // loopback URL Bot Factory can never reach: the bridge is off, not the service.
  it('only warns on a loopback URL when the bridge is not required', () => {
    const env = { ...PROD_ENV, MCP_SERVER_URL: 'https://localhost/api/connector/mcp' };
    expect(findEnvProblems(env)).toEqual([]);
    expect(findEnvWarnings(env).join(' ')).toContain('MCP_SERVER_URL');
  });

  it('refuses a loopback URL when BOT_BRIDGE_ENABLED=true', () => {
    const env = {
      ...PROD_ENV,
      MCP_SERVER_URL: 'https://localhost/api/connector/mcp',
      BOT_BRIDGE_ENABLED: 'true',
    };
    expect(findEnvProblems(env).join(' ')).toContain('MCP_SERVER_URL');
  });

  it('refuses a non-https public URL', () => {
    const env = { ...PROD_ENV, MCP_SERVER_URL: 'http://pon.example/api/connector/mcp' };
    expect(findEnvProblems(env)).toEqual(['MCP_SERVER_URL must be an https URL']);
  });
});

describe('resolveAllowedOrigins', () => {
  it('prefers an explicit CORS_ORIGINS list', () => {
    expect(
      resolveAllowedOrigins({
        ...PROD_ENV,
        CORS_ORIGINS: 'https://a.example, https://b.example',
      }),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falls back to the origin of CLIENT_REDIRECT_URL — existing deployments keep working', () => {
    expect(resolveAllowedOrigins(PROD_ENV)).toEqual(['https://web.pon.example']);
  });

  it('returns nothing in production when neither is usable, so bootstrap refuses to start', () => {
    expect(
      resolveAllowedOrigins({ NODE_ENV: 'production', CLIENT_REDIRECT_URL: 'not a url' }),
    ).toEqual([]);
  });

  it('falls back to the local origins outside production', () => {
    expect(resolveAllowedOrigins({})).toEqual(DEV_ORIGINS);
  });
});
