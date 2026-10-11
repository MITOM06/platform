import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { propagation, context, trace, SpanStatusCode } from '@opentelemetry/api';
import { AiService, AiRequestPayload } from './ai.service';
import { AI_QUEUE, AI_SUBSCRIPTION } from '../rabbitmq/rabbitmq.topology';

@Injectable()
export class AiConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiConsumer.name);
  private readonly tracer = trace.getTracer('ai-service');

  constructor(
    private readonly aiService: AiService,
    private readonly amqp: AmqpConnection,
  ) {}

  /**
   * Subscribe to ai.requests without waiting for it: the setup runs whenever
   * the broker connects — now, after an outage, and again after every
   * reconnect. Waiting for it (the library's own handler registration) kept the
   * HTTP server from starting while RabbitMQ was unreachable.
   */
  onApplicationBootstrap(): void {
    this.amqp
      .createSubscriber<AiRequestPayload>(
        (payload, amqpMsg) => this.handleAiRequest(payload as AiRequestPayload, amqpMsg as ConsumeMessage),
        AI_SUBSCRIPTION,
        'AiConsumer.handleAiRequest',
      )
      .then(() => this.logger.log(`Consuming ${AI_QUEUE}`))
      .catch((err) => this.logger.error(`Could not subscribe to ${AI_QUEUE}`, err));
  }

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
        // Rethrow so the NACK errorBehavior dead-letters the message to
        // ai.requests.dlq (once — never requeued) instead of auto-acking it.
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
