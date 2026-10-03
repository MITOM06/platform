import {
  AI_DLQ,
  AI_DLQ_ROUTING_KEY,
  AI_DLX,
  AI_QUEUE,
  AI_QUEUE_ARGUMENTS,
  buildRabbitConfig,
} from './rabbitmq.topology';

describe('buildRabbitConfig', () => {
  const config = buildRabbitConfig('amqp://test');

  it('declares the dead-letter exchange the request queue points at', () => {
    expect(AI_QUEUE_ARGUMENTS['x-dead-letter-exchange']).toBe(AI_DLX);
    expect(config.exchanges).toContainEqual({ name: AI_DLX, type: 'direct' });
  });

  it('declares the DLQ bound to the DLX on the dead-letter routing key', () => {
    const dlq = config.queues?.find((q) => q.name === AI_DLQ);
    expect(dlq).toMatchObject({ exchange: AI_DLX, routingKey: AI_DLQ_ROUTING_KEY });
    expect(AI_QUEUE_ARGUMENTS['x-dead-letter-routing-key']).toBe(AI_DLQ_ROUTING_KEY);
  });

  it('keeps ai.requests arguments identical to chat-service (TTL 30s + DLX)', () => {
    const queue = config.queues?.find((q) => q.name === AI_QUEUE);
    expect(queue?.options?.arguments).toEqual({
      'x-dead-letter-exchange': 'ai.dead-letter',
      'x-dead-letter-routing-key': 'dlq',
      'x-message-ttl': 30_000,
    });
  });
});
