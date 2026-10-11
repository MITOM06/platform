import { Test } from "@nestjs/testing";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { AiConsumer } from "../ai/ai.consumer";
import { AiService } from "../ai/ai.service";
import { buildRabbitConfig } from "./rabbitmq.topology";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms).unref());

/**
 * Production 2026-10-11: the CloudAMQP vhost vanished and ai-service never
 * listened. The library awaited the ai.requests consumer — which waits for a
 * channel — inside onApplicationBootstrap, so /health, usage, AI sessions and
 * action confirm were all down together with RabbitMQ.
 */
describe("ai-service start-up while RabbitMQ is unreachable", () => {
  it("finishes bootstrapping instead of waiting for the broker", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        RabbitMQModule.forRootAsync({
          useFactory: () => buildRabbitConfig("amqp://127.0.0.1:1"),
        }),
      ],
      providers: [
        AiConsumer,
        { provide: AiService, useValue: { handleRequest: jest.fn() } },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();

    const outcome = await Promise.race([
      app.init().then(() => "started"),
      sleep(5_000).then(() => "hung"),
    ]);

    expect(outcome).toBe("started");
    await Promise.race([app.close(), sleep(3_000)]);
  }, 15_000);
});
