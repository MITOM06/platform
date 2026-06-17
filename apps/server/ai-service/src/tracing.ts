/**
 * OpenTelemetry SDK bootstrap.
 * MUST be imported as the very first line of main.ts so OTel can patch modules
 * (amqplib, ioredis, http) before they are loaded by NestJS / the app.
 *
 * Guard: OTEL_ENABLED=false → no-ops entirely.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

if (process.env.OTEL_ENABLED !== 'false') {
  // Enable OTel diagnostic logging at WARN level to surface export errors without spamming.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  const exporters: SpanExporter[] = [];

  // OTLP HTTP exporter — points to Jaeger (or any OTLP collector).
  // The SDK handles export failures gracefully; a Jaeger-down scenario is non-fatal.
  exporters.push(
    new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      // Default 10 s timeout; keep low so export failures don't block shutdown.
      timeoutMillis: 5000,
    }),
  );

  // Console fallback: active when no OTLP endpoint is configured OR explicitly enabled.
  if (
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_TRACES_CONSOLE === 'true'
  ) {
    exporters.push(new ConsoleSpanExporter());
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]:
      process.env.OTEL_SERVICE_NAME ?? 'ai-service',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
  });

  // Build span processors — BatchSpanProcessor for OTLP, SimpleSpanProcessor for console.
  const spanProcessors = exporters.map((exp, idx) =>
    idx === 0 ? new BatchSpanProcessor(exp) : new SimpleSpanProcessor(exp),
  );

  const sdk = new NodeSDK({
    resource,
    spanProcessors,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation; keep http, ioredis, amqplib.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  // Start synchronously so patches are applied before NestJS modules load.
  sdk.start();
}
