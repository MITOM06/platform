import { sentryOptions } from "./sentry-options";

/**
 * tracing.ts already registers OpenTelemetry's global tracer, propagator and
 * context manager; Sentry v8+ registering its own on top logged "Attempted
 * duplicate registration of API" three times on every boot.
 */
describe("sentryOptions", () => {
  it("leaves OpenTelemetry to tracing.ts while it runs", () => {
    expect(sentryOptions({}).skipOpenTelemetrySetup).toBe(true);
    expect(sentryOptions({ OTEL_ENABLED: "true" }).skipOpenTelemetrySetup).toBe(
      true,
    );
  });

  it("lets Sentry set OpenTelemetry up when tracing.ts is off", () => {
    expect(
      sentryOptions({ OTEL_ENABLED: "false" }).skipOpenTelemetrySetup,
    ).toBe(false);
  });

  it("is only enabled with a DSN", () => {
    expect(sentryOptions({}).enabled).toBe(false);
    expect(
      sentryOptions({
        SENTRY_DSN: "https://k@sentry.test/1",
        NODE_ENV: "production",
      }),
    ).toMatchObject({
      enabled: true,
      dsn: "https://k@sentry.test/1",
      environment: "production",
    });
  });
});
