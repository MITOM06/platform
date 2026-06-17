# Distributed Tracing — Observability Guide

## End-to-End Trace Path

```
User sends @AI message
  └─ chat-service: span ai.request.publish
       └─ RabbitMQ: ai.requests queue (traceparent in AMQP headers)
            └─ ai-service: span agentic_loop (W3C context extracted from headers)
                 ├─ tool call spans (search_knowledge_base, etc.)
                 └─ Redis PUBLISH ai:response:{conversationId} (_traceparent in JSON payload)
                      └─ chat-service: span ai.response.deliver (W3C context extracted from payload)
                           └─ STOMP /topic/conversation/{id} → browser / Flutter client
```

The entire flow is a **single distributed trace** visible in Jaeger.

## How Propagation Works

### chat-service → ai-service (RabbitMQ hop)

`AiRedisPublisher.publishAiRequest()` creates a span `ai.request.publish`, then calls
`Propagator.inject()` with a `MessagePostProcessor` that writes the W3C `traceparent`
(and `tracestate` if present) into the AMQP message headers under the key `traceparent`.

The ai-service (`ai.consumer.ts`) reads that header via `@golevelup/nestjs-rabbitmq`'s
`amqpMsg.properties.headers.traceparent` and restores the OTel context before starting
its own `agentic_loop` span.

### ai-service → chat-service (Redis hop)

The ai-service includes `_traceparent` (a W3C `traceparent` string) in every Redis JSON
payload it publishes to `ai:response:{conversationId}`.

`AiResponseListener.onMessage()` reads `_traceparent`, constructs a `Map<String, String>`
carrier (`{"traceparent": "<value>"}`), and calls `Propagator.extract()` to restore the
parent context. The `ai.response.deliver` span is started as a child of that context,
making STOMP delivery part of the same end-to-end trace.

When `_traceparent` is absent (e.g. during tests or for non-AI messages) a fresh root
span is created so delivery work is still individually observable.

## Running the Full Stack with Tracing

### Local (services on host, infra in Docker)

```bash
# 1. Start infrastructure (Jaeger is included)
docker compose -f infra/docker-compose/compose.yml up -d jaeger redis mongo rabbitmq qdrant

# 2. Start chat-service (picks up localhost:4318 by default)
cd apps/server/chat-service && mvn spring-boot:run

# 3. Start ai-service
cd apps/server/ai-service && pnpm start:dev
```

The `application.yml` defaults:
```yaml
management.otlp.tracing.endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://localhost:4318}/v1/traces
management.tracing.sampling.probability: ${OTEL_SAMPLING_PROBABILITY:1.0}
```

### Containerised (full docker compose)

```bash
docker compose -f infra/docker-compose/compose.yml up -d
```

`chat-service` container gets:
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY=1.0`

`ai-service` container gets:
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
- `OTEL_SERVICE_NAME=ai-service`

## Viewing Traces in Jaeger

Open **http://localhost:16686**

1. Select service `chat-service` or `ai-service` in the search dropdown.
2. Click **Find Traces**.
3. Click any trace — you will see spans from both services linked in the same waterfall
   when a full AI request completes.

Key span names to look for:

| Span | Service | Meaning |
|------|---------|---------|
| `ai.request.publish` | chat-service | RabbitMQ publish with traceparent injected |
| `agentic_loop` | ai-service | Full AI processing including tool calls |
| `ai.response.deliver` | chat-service | STOMP push to clients |

## Environment Toggles

| Variable | Default | Effect |
|----------|---------|--------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP HTTP collector endpoint |
| `OTEL_SAMPLING_PROBABILITY` | `1.0` | Fraction of traces sampled (0.0–1.0) |
| `management.tracing.enabled` | `true` | Set to `false` to disable entirely (test profile sets this) |

In the **test profile** (`src/test/resources/application.properties`), tracing is disabled
(`management.tracing.enabled=false`) to prevent OTLP connection errors during unit tests.
