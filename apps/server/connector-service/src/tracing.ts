/**
 * OpenTelemetry bootstrap — MUST be the first import of main.ts so it can patch
 * http / express / mongodb / ioredis before NestJS loads them. Spans go to the
 * OTLP endpoint (Jaeger locally), so one request can be followed across
 * chat-service, ai-service, connector-service and auth-service. Mirrors
 * ai-service `src/tracing.ts`.
 *
 * OTEL_ENABLED=false (production on the Mac mini, self-host) → no-op.
 */
import { NodeSDK, tracing } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { applyExporterDefaults } from "./tracing-defaults";

if (process.env.OTEL_ENABLED !== "false") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  applyExporterDefaults(process.env);

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  const spanProcessors: tracing.SpanProcessor[] = [
    new tracing.BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
        timeoutMillis: 5000,
      }),
    ),
  ];
  if (process.env.OTEL_TRACES_CONSOLE === "true") {
    spanProcessors.push(
      new tracing.SimpleSpanProcessor(new tracing.ConsoleSpanExporter()),
    );
  }

  new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "connector-service",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    }),
    spanProcessors,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  }).start();
}
