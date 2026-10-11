import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
  getHandlerForLegacyBehavior,
} from "@golevelup/nestjs-rabbitmq";
import { ConsumeMessage } from "amqplib";
import { AiConsumer } from "./ai.consumer";
import { AiService, AiRequestPayload } from "./ai.service";
import {
  AI_QUEUE,
  AI_QUEUE_ARGUMENTS,
  AI_SUBSCRIPTION,
} from "../rabbitmq/rabbitmq.topology";

const payload = {
  conversationId: "conv-1",
  userId: "user-1",
} as AiRequestPayload;
const amqpMsg = { properties: { headers: {} } } as unknown as ConsumeMessage;

function consumerWith(
  aiService: Partial<AiService>,
  amqp: Partial<AmqpConnection> = {},
) {
  return new AiConsumer(aiService as AiService, amqp as AmqpConnection);
}

describe("AiConsumer", () => {
  it("nacks a failed request without requeue so it is dead-lettered once", () => {
    expect(AI_SUBSCRIPTION.errorBehavior).toBe(
      MessageHandlerErrorBehavior.NACK,
    );

    // The behavior must resolve to nack(msg, allUpTo=false, requeue=false).
    const channel = { nack: jest.fn(), ack: jest.fn() };
    getHandlerForLegacyBehavior(AI_SUBSCRIPTION.errorBehavior!)(
      channel as never,
      amqpMsg,
      new Error("boom"),
    );
    expect(channel.nack).toHaveBeenCalledWith(amqpMsg, false, false);
  });

  it("subscribes to ai.requests with the shared dead-letter arguments", () => {
    expect(AI_SUBSCRIPTION.queue).toBe(AI_QUEUE);
    expect(AI_SUBSCRIPTION.queueOptions?.arguments).toEqual(AI_QUEUE_ARGUMENTS);
  });

  it("registers the subscription at bootstrap without waiting for the broker", async () => {
    // The broker is down: the subscription never completes.
    const createSubscriber = jest
      .fn()
      .mockReturnValue(new Promise(() => undefined));
    const aiService = { handleRequest: jest.fn().mockResolvedValue(undefined) };
    const consumer = consumerWith(aiService, { createSubscriber });

    expect(consumer.onApplicationBootstrap()).toBeUndefined();

    expect(createSubscriber).toHaveBeenCalledWith(
      expect.any(Function),
      AI_SUBSCRIPTION,
      "AiConsumer.handleAiRequest",
    );
    // The registered handler is the consumer's own.
    const handler = createSubscriber.mock.calls[0][0];
    await handler(payload, amqpMsg);
    expect(aiService.handleRequest).toHaveBeenCalledWith(payload);
  });

  it("a failed subscription is logged, not thrown", async () => {
    const createSubscriber = jest
      .fn()
      .mockRejectedValue(new Error("PRECONDITION_FAILED"));
    const consumer = consumerWith(
      { handleRequest: jest.fn() },
      { createSubscriber },
    );

    expect(() => consumer.onApplicationBootstrap()).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });

  it("rethrows a processing failure so the error behavior applies", async () => {
    const aiService = {
      handleRequest: jest.fn().mockRejectedValue(new Error("401")),
    };
    const consumer = consumerWith(aiService);

    await expect(consumer.handleAiRequest(payload, amqpMsg)).rejects.toThrow(
      "401",
    );
    expect(aiService.handleRequest).toHaveBeenCalledTimes(1);
  });

  it("resolves normally when the request succeeds", async () => {
    const aiService = { handleRequest: jest.fn().mockResolvedValue(undefined) };
    const consumer = consumerWith(aiService);

    await expect(
      consumer.handleAiRequest(payload, amqpMsg),
    ).resolves.toBeUndefined();
  });
});
