# Task 10a — OpenTelemetry Tracing in ai-service + Jaeger in docker-compose

## Files Changed

| File | Change |
|------|--------|
| `apps/server/ai-service/src/tracing.ts` | New — NodeSDK bootstrap; OTLP HTTP exporter to Jaeger, optional console exporter, `OTEL_ENABLED` guard |
| `apps/server/ai-service/src/main.ts` | `import './tracing'` added as very first line (before Sentry) |
| `apps/server/ai-service/src/ai/ai.consumer.ts` | Extracts W3C `traceparent`/`tracestate` from AMQP message headers via `propagation.extract`; wraps handler in extracted context + `ai.consume_request` span |
| `apps/server/ai-service/src/ai/tracing-helpers.ts` | New — `withAgenticLoopSpan()` wraps `_agenticLoop` in `ai.agentic_loop` span; records `ai.model`, `ai.input_tokens`, `ai.output_tokens`, `ai.thinking_tokens`, `ai.tool_rounds`, `ai.latency_ms`; increments `ai.tokens` counter metrics with `{direction, model}` |
| `apps/server/ai-service/src/ai/ai.service.ts` | Import `withAgenticLoopSpan`; both primary and fallback `_agenticLoop` calls wrapped |
| `apps/server/ai-service/src/redis/redis-publisher.service.ts` | `injectTrace()` helper calls `propagation.inject` into a carrier and merges `_traceparent`/`_tracestate` into every published payload (both `publish` and `publishToChannel`) |
| `apps/server/ai-service/.env.example` | Documents `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_CONSOLE`, `OTEL_SERVICE_NAME` |
| `apps/server/ai-service/package.json` | Added 7 OTel deps: `@opentelemetry/sdk-node`, `auto-instrumentations-node`, `exporter-trace-otlp-http`, `exporter-metrics-otlp-http`, `resources`, `semantic-conventions`, `api` |
| `infra/docker-compose/compose.yml` | Added `jaeger` service (`jaegertracing/all-in-one:1.62`, ports 16686/4318/4317, `COLLECTOR_OTLP_ENABLED=true`, healthcheck, `app-net`); added `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318` to `ai-service` env |

## Deps Added

```
@opentelemetry/api                      ^1.9.1
@opentelemetry/sdk-node                 ^0.219.0
@opentelemetry/auto-instrumentations-node ^0.77.0
@opentelemetry/exporter-trace-otlp-http ^0.219.0
@opentelemetry/exporter-metrics-otlp-http ^0.219.0
@opentelemetry/resources                ^2.8.0
@opentelemetry/semantic-conventions     ^1.41.1
```

Note: `@opentelemetry/resources` v2 uses `resourceFromAttributes()` factory (not `new Resource()`). The tracing bootstrap uses the v2 API.

## traceparent Flow

```
chat-service (Java)
  → publishes to RabbitMQ ai.requests queue
  → AMQP message headers include W3C traceparent (task 10b will inject this)

ai-service ai.consumer.ts
  → reads headers from amqplib ConsumeMessage.properties.headers
  → propagation.extract(context.active(), carrier) → extractedCtx
  → context.with(extractedCtx, ...) — all child spans become children of chat-service trace
  → starts ai.consume_request span

ai-service ai.service.ts (via tracing-helpers.ts)
  → withAgenticLoopSpan() starts ai.agentic_loop span (child of ai.consume_request)
  → after loop: span attributes set (tokens, latency, model, tool_rounds)
  → ai.tokens counter incremented for OTLP metrics

ai-service redis-publisher.service.ts
  → injectTrace() calls propagation.inject into carrier
  → _traceparent + _tracestate merged into every Redis payload
  → chat-service Redis subscriber reads _traceparent to continue trace (task 10b)
```

## AI Span Attributes + Metrics

| OTel Attribute | Source |
|----------------|--------|
| `ai.model` | `AiTrace.model` (set by router) |
| `ai.input_tokens` | `AiTrace.inputTokens` (sum across all API calls) |
| `ai.output_tokens` | `AiTrace.outputTokens` |
| `ai.thinking_tokens` | `AiTrace.thinkingTokens` (approx from thinking blocks) |
| `ai.tool_rounds` | `AiTrace.iterationCount` |
| `ai.latency_ms` | `AiTrace.processingMs` = `Date.now() - startMs` |
| `ai.conversation_id` | from payload |

OTel Metric: `ai.tokens` counter with dimensions `{direction: input|output, model}`.
Decision: span attributes are the primary record; the `ai.tokens` counter supplements them. Full OTLP metrics setup (MetricReader) is handled by the SDK's default metrics pipeline — no custom MeterProvider needed for this counter to work once the OTLP metrics exporter is present.

## Jaeger Config

```yaml
jaeger:
  image: jaegertracing/all-in-one:1.62
  ports:
    - "16686:16686"   # UI
    - "4318:4318"     # OTLP HTTP
    - "4317:4317"     # OTLP gRPC
  environment:
    COLLECTOR_OTLP_ENABLED: "true"
  healthcheck: wget http://localhost:16686
  networks: [app-net]
```

Start with: `docker compose -f infra/docker-compose/compose.yml up -d jaeger`
UI: http://localhost:16686

## Build + Test Results

| Check | Result |
|-------|--------|
| `pnpm install` | clean (154 packages) |
| `pnpm run build` | 0 TypeScript errors |
| `pnpm exec jest --ci` | 89 tests passed, 11 suites, 0 failures |
| compose yaml (manual) | jaeger service, ports, healthcheck verified |
| `import './tracing'` line 1 of main.ts | confirmed |
| `propagation.inject` in redis-publisher | confirmed (line 42) |
| `propagation.extract` + `traceparent` in ai.consumer | confirmed (lines 31, 33, 47) |

## Commit

`46207c31` — feat(obs): OpenTelemetry tracing + AI metrics in ai-service, add Jaeger to compose

## Deferred to Task 10b (chat-service Java)

- Inject W3C `traceparent` into the RabbitMQ AMQP message properties/headers when chat-service publishes to `ai.requests` queue (so ai-service can extract it as implemented here)
- Extract `_traceparent` from the Redis `ai:response:{conversationId}` payload in chat-service's `AiResponseListener` to continue the trace through the STOMP delivery path
- Add `opentelemetry-spring-boot-starter` or `opentelemetry-instrumentation` to chat-service's Maven dependencies
