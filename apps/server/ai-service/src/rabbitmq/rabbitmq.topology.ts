import {
  MessageHandlerErrorBehavior,
  MessageHandlerOptions,
  RabbitMQConfig,
} from '@golevelup/nestjs-rabbitmq';

// Must match chat-service RabbitMqConfig — queue arguments are part of the
// queue's identity, so a mismatch fails the declaration with PRECONDITION_FAILED.
export const AI_EXCHANGE = 'ai.direct';
export const AI_QUEUE = 'ai.requests';
export const AI_ROUTING_KEY = 'ai.request';
export const AI_DLX = 'ai.dead-letter';
export const AI_DLQ = 'ai.requests.dlq';
export const AI_DLQ_ROUTING_KEY = 'dlq';

export const AI_QUEUE_ARGUMENTS = {
  'x-dead-letter-exchange': AI_DLX,
  'x-dead-letter-routing-key': AI_DLQ_ROUTING_KEY,
  'x-message-ttl': 30_000,
};

/**
 * The ai.requests subscription. AiConsumer registers it itself, without waiting
 * for the broker (see AiConsumer.onApplicationBootstrap).
 */
export const AI_SUBSCRIPTION: MessageHandlerOptions = {
  exchange: AI_EXCHANGE,
  routingKey: AI_ROUTING_KEY,
  queue: AI_QUEUE,
  queueOptions: { durable: true, arguments: AI_QUEUE_ARGUMENTS },
  // The library default is REQUEUE: a failed request was redelivered ~1/s until
  // its 30s TTL ran out — dozens of model calls, AI_STREAM_ERROR events and
  // rate-limit hits per user message. NACK without requeue dead-letters it once.
  errorBehavior: MessageHandlerErrorBehavior.NACK,
};

/**
 * Full AI request topology, declared by ai-service itself. chat-service also
 * describes it, but its RabbitAdmin has autoStartup=false and so never declares
 * anything — without this the dead-letter exchange/queue did not exist and every
 * nacked request was silently dropped.
 */
export function buildRabbitConfig(uri: string): RabbitMQConfig {
  return {
    uri,
    exchanges: [
      { name: AI_EXCHANGE, type: 'direct' },
      { name: AI_DLX, type: 'direct' },
    ],
    queues: [
      {
        name: AI_QUEUE,
        options: { durable: true, arguments: AI_QUEUE_ARGUMENTS },
      },
      {
        name: AI_DLQ,
        options: { durable: true },
        exchange: AI_DLX,
        routingKey: AI_DLQ_ROUTING_KEY,
      },
    ],
    connectionInitOptions: { wait: false },
    // The library awaits each handler's consumer setup in onApplicationBootstrap,
    // and that waits for a channel: with the broker down the HTTP server never
    // started. AiConsumer subscribes itself instead.
    registerHandlers: false,
  };
}
