import type { NodeOptions } from '@sentry/node';

/**
 * Sentry options for main.ts. tracing.ts (the first import) already owns
 * OpenTelemetry while OTEL_ENABLED is not 'false'; Sentry then only captures
 * errors and must not register its own global tracer, propagator and context
 * manager (that logged "Attempted duplicate registration of API" on boot).
 */
export function sentryOptions(env: NodeJS.ProcessEnv): NodeOptions {
  return {
    dsn: env.SENTRY_DSN ?? '',
    environment: env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    enabled: !!env.SENTRY_DSN,
    skipOpenTelemetrySetup: env.OTEL_ENABLED !== 'false',
  };
}
