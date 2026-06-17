# Task 10b Report — OpenTelemetry Tracing (chat-service)

## Dependencies Added (`pom.xml`)

Two dependencies were added under the Spring Boot BOM (no version pins needed):

```xml
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
  <groupId>io.opentelemetry</groupId>
  <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

`spring-boot-starter-actuator` was already present. Spring Boot 3.3.5 BOM resolves
`micrometer-tracing` 1.3.5 and the OTel bridge + OTLP exporter at compatible versions.

## Config Added (`application.yml`)

```yaml
management:
  tracing:
    sampling:
      probability: ${OTEL_SAMPLING_PROBABILITY:1.0}
  otlp:
    tracing:
      endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:http://localhost:4318}/v1/traces
```

Both are env-overridable. The test profile (`src/test/resources/application.properties`)
sets `management.tracing.enabled=false` to prevent OTLP connection errors during unit tests.

## Inject Point (RabbitMQ — chat→ai)

`AiRedisPublisher.publishAiRequest()`:
- Autowires `Tracer` and `Propagator` (both are Spring beans provided by the bridge).
- Creates span `ai.request.publish` via `tracer.nextSpan().name(...).start()`.
- Passes a `MessagePostProcessor` lambda to `rabbitTemplate.convertAndSend()`.
- Inside the lambda: `propagator.inject(span.context(), messageProperties, (msg, key, value) -> msg.getHeaders().put(key, value))`.
- This writes the lowercase `traceparent` (and `tracestate`) into the AMQP headers — exactly the key the ai-service reads.

## Extract Point (Redis — ai→chat)

`AiResponseListener.onMessage()` / `buildDeliverSpan()`:
- Reads `_traceparent` from the JSON payload (may be null — handled gracefully).
- When present: calls `propagator.extract(Map.of("traceparent", value), Map::get)` which returns a `Span.Builder` already wired to the remote parent context.
- Names the builder `ai.response.deliver`, adds tags, starts the span.
- Runs all STOMP delivery work inside `tracer.withSpan(span)` so it appears as a child.
- When absent: `tracer.nextSpan()` creates a fresh root span — delivery is still observable.

## End-to-End Trace Path

```
chat-service: ai.request.publish
  RabbitMQ (traceparent in AMQP headers)
    ai-service: agentic_loop (extracted from headers)
      Redis PUBLISH (_traceparent in JSON payload)
        chat-service: ai.response.deliver (extracted from payload)
          STOMP → browser / Flutter
```

## Verify Output

### mvn compile
```
(no output — clean)
```

### mvn test-compile
```
(no output — clean)
```

### mvn test
```
[INFO] Tests run: 7,  Failures: 0, Errors: 0, Skipped: 0  -- AuthChannelInterceptorTest
[INFO] Tests run: 8,  Failures: 0, Errors: 0, Skipped: 0  -- AiPersonaControllerTest
[INFO] Tests run: 5,  Failures: 0, Errors: 0, Skipped: 0  -- KbControllerTest
[INFO] Tests run: 6,  Failures: 0, Errors: 0, Skipped: 0  -- ChatControllerTest
[INFO] Tests run: 6,  Failures: 0, Errors: 0, Skipped: 0  -- AiMemoryControllerTest
[INFO] Tests run: 31, Failures: 0, Errors: 0, Skipped: 0  -- MessageServiceTest
[INFO] Tests run: 19, Failures: 0, Errors: 0, Skipped: 0  -- ConversationServiceTest
[INFO] Tests run: 4,  Failures: 0, Errors: 0, Skipped: 0  -- MessageServicePaginationTest (Testcontainers)
[INFO] Tests run: 6,  Failures: 0, Errors: 0, Skipped: 0  -- AiResponseListenerTest
[INFO] Tests run: 92, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### grep traceparent
```
AiResponseListener.java:53  String traceparent = (String) payload.get("_traceparent");
AiResponseListener.java:76  Map<String, String> carrier = Map.of("traceparent", traceparent);
AiRedisPublisher.java:45    // The ai-service reads the lowercase "traceparent" key from these headers.
```
Both inject (publisher) and extract (listener) confirmed present.

## Commit Hash

`0b9c502e`

## Files Changed

| File | Change |
|------|--------|
| `apps/server/chat-service/pom.xml` | Added micrometer-tracing-bridge-otel + opentelemetry-exporter-otlp |
| `apps/server/chat-service/src/main/resources/application.yml` | Added management.tracing + management.otlp.tracing config |
| `apps/server/chat-service/src/main/java/.../service/AiRedisPublisher.java` | Inject traceparent into AMQP headers via Propagator |
| `apps/server/chat-service/src/main/java/.../service/AiResponseListener.java` | Extract _traceparent from Redis payload; ai.response.deliver span |
| `apps/server/chat-service/src/test/resources/application.properties` | Disable tracing in test profile |
| `apps/server/chat-service/src/test/java/.../service/AiResponseListenerTest.java` | Updated mocks for Tracer+Propagator; added traceparent test; @MockitoSettings(LENIENT) |
| `infra/docker-compose/compose.yml` | Added OTEL env vars + jaeger dependency to chat-service |
| `docs/observability.md` | New — full e2e trace path, run instructions, Jaeger UI guide, env toggles |
