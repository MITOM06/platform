import {
  MessageHandlerErrorBehavior,
  RABBIT_HANDLER,
  RabbitHandlerConfig,
  getHandlerForLegacyBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { AiConsumer } from './ai.consumer';
import { AiService, AiRequestPayload } from './ai.service';
import { AI_QUEUE, AI_QUEUE_ARGUMENTS } from '../rabbitmq/rabbitmq.topology';

const payload = { conversationId: 'conv-1', userId: 'user-1' } as AiRequestPayload;
const amqpMsg = { properties: { headers: {} } } as unknown as ConsumeMessage;

function handlerConfig(): RabbitHandlerConfig {
  return Reflect.getMetadata(RABBIT_HANDLER, AiConsumer.prototype.handleAiRequest);
}

describe('AiConsumer', () => {
  it('nacks a failed request without requeue so it is dead-lettered once', () => {
    const config = handlerConfig();
    expect(config.errorBehavior).toBe(MessageHandlerErrorBehavior.NACK);

    // The behavior must resolve to nack(msg, allUpTo=false, requeue=false).
    const channel = { nack: jest.fn(), ack: jest.fn() };
    getHandlerForLegacyBehavior(config.errorBehavior!)(channel as never, amqpMsg, new Error('boom'));
    expect(channel.nack).toHaveBeenCalledWith(amqpMsg, false, false);
  });

  it('subscribes to ai.requests with the shared dead-letter arguments', () => {
    const config = handlerConfig();
    expect(config.queue).toBe(AI_QUEUE);
    expect(config.queueOptions?.arguments).toEqual(AI_QUEUE_ARGUMENTS);
  });

  it('rethrows a processing failure so the error behavior applies', async () => {
    const aiService = { handleRequest: jest.fn().mockRejectedValue(new Error('401')) };
    const consumer = new AiConsumer(aiService as unknown as AiService);

    await expect(consumer.handleAiRequest(payload, amqpMsg)).rejects.toThrow('401');
    expect(aiService.handleRequest).toHaveBeenCalledTimes(1);
  });

  it('resolves normally when the request succeeds', async () => {
    const aiService = { handleRequest: jest.fn().mockResolvedValue(undefined) };
    const consumer = new AiConsumer(aiService as unknown as AiService);

    await expect(consumer.handleAiRequest(payload, amqpMsg)).resolves.toBeUndefined();
  });
});
