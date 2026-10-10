/**
 * Jaeger takes traces only. Left unset, the OpenTelemetry SDK also exports
 * metrics and logs over OTLP (its defaults) and logs an export failure (404)
 * every minute — default them off. An explicit value wins.
 */
export function applyExporterDefaults(env: NodeJS.ProcessEnv): void {
  env.OTEL_METRICS_EXPORTER ??= 'none';
  env.OTEL_LOGS_EXPORTER ??= 'none';
}
