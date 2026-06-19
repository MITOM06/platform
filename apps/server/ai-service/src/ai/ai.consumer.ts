import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { propagation, context, trace, SpanStatusCode } from '@opentelemetry/api';
import { AiService, AiRequestPayload } from './ai.service';

@Injectable()
export class AiConsumer {
  private readonly logger = new Logger(AiConsumer.name);
  private readonly tracer = trace.getTracer('ai-service');

  constructor(private readonly aiService: AiService) {}

  @RabbitSubscribe({
    exchange: 'ai.direct',
    routingKey: 'ai.request',
    queue: 'ai.requests',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'ai.dead-letter',
        'x-dead-letter-routing-key': 'dlq',
        'x-message-ttl': 30000,
      },
    },
  })
  async handleAiRequest(
    payload: AiRequestPayload,
    amqpMsg: ConsumeMessage,
  ): Promise<void> {
    // Extract W3C traceparent / tracestate from AMQP message headers.
    // If headers are absent or malformed (e.g. messages published before tracing
    // was added), propagation.extract returns a fresh root context — no crash.
    const headers = amqpMsg?.properties?.headers ?? {};
    // AMQP headers values may be Buffer; convert to string for the OTel carrier.
    const carrier: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        carrier[key] = value;
      } else if (Buffer.isBuffer(value)) {
        carrier[key] = value.toString('utf8');
      } else if (value !== null && value !== undefined) {
        carrier[key] = String(value);
      }
    }

    const extractedCtx = propagation.extract(context.active(), carrier);

    await context.with(extractedCtx, async () => {
      const span = this.tracer.startSpan('ai.consume_request', {
        attributes: {
          'messaging.system': 'rabbitmq',
          'messaging.destination': 'ai.requests',
          'ai.conversation_id': payload.conversationId,
          'ai.user_id': payload.userId,
        },
      });

      try {
        await context.with(trace.setSpan(context.active(), span), async () => {
          await this.aiService.handleRequest(payload);
        });
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        this.logger.error(
          `Failed to process AI request for conversation ${payload.conversationId}`,
          err,
        );
        // AiService already published AI_STREAM_ERROR to Redis for the client.
        // Rethrow so RabbitMQ nacks and the message is dead-lettered per the
        // configured DLX/TTL instead of being silently auto-acked.
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
