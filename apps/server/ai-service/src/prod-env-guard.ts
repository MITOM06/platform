/**
 * Production boot check for ai-service's backing services. Every infrastructure
 * address in config/configuration.ts carries a localhost default, so a missing
 * secret would otherwise yield a healthy-looking revision wired to nothing.
 *
 * An EMPTY value counts as unset: compose files pass optional URLs as
 * `${REDIS_URL:-}`, which reaches the container as "" — and `"" ?? REDIS_HOST`
 * kept the empty string, so the self-host stack refused to boot.
 */
export type Env = Record<string, string | undefined>;

const LOOPBACK = /localhost|127\.0\.0\.1|::1/i;

/** Names of the fatal addresses that are missing or point at this container. */
export function findFatalInfraProblems(env: Env): string[] {
  const checks: Array<[string, string | undefined]> = [
    ['MONGODB_URI', env.MONGODB_URI],
    ['REDIS_URL / REDIS_HOST', env.REDIS_URL || env.REDIS_HOST],
    ['RABBITMQ_URL', env.RABBITMQ_URL],
  ];
  return checks.filter(([, v]) => !v || LOOPBACK.test(v)).map(([k]) => k);
}

/** Optional addresses whose absence only degrades the service (RAG / memory off). */
export function findDegradedInfra(env: Env): string[] {
  return (['QDRANT_URL', 'VOYAGE_API_KEY'] as const).filter((key) => {
    const value = env[key];
    return !value || LOOPBACK.test(value);
  });
}
