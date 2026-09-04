import { findEnvProblems, resolveAllowedOrigins, DEV_ORIGINS } from './env-guard';

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
