import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LlmClient, OpenRouterClient } from './openrouter-client';

export interface LightCallResult {
  message: Anthropic.Message;
  /** The model that actually answered (OpenRouter, or the Claude fallback). */
  model: string;
}

/**
 * Picks the model client per call. Cost split: light work — the router's fast
 * tier and small utility calls (session titles, compaction, memory facts,
 * daily digests) — goes to OpenRouter when OPENROUTER_API_KEY is set; mid /
 * complex chat, KB-grounded answers, images and call summaries stay on Claude.
 * OpenRouter models are the `vendor/model` ids (Anthropic ids never contain
 * `/`). A failed light call is retried once on the Claude light model.
 */
@Injectable()
export class LlmClientsService {
  private readonly logger = new Logger(LlmClientsService.name);
  private readonly anthropic: LlmClient;
  private readonly openRouter: OpenRouterClient | null;
  private readonly openRouterModel: string | null;
  private readonly claudeLightModel: string;

  constructor(configService: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: configService.get<string>('config.anthropic.apiKey'),
    }) as unknown as LlmClient;
    this.claudeLightModel =
      configService.get<string>('config.anthropic.fallbackModel') ?? 'claude-haiku-4-5';

    const apiKey = configService.get<string>('config.openRouter.apiKey');
    const model = configService.get<string>('config.openRouter.model');
    if (apiKey && model) {
      this.openRouter = new OpenRouterClient({
        apiKey,
        baseUrl:
          configService.get<string>('config.openRouter.baseUrl') ?? 'https://openrouter.ai/api/v1',
        appUrl: configService.get<string>('config.openRouter.appUrl'),
        appTitle: 'PON',
      });
      this.openRouterModel = model;
      this.logger.log(`OpenRouter light tier on: ${model}`);
    } else {
      this.openRouter = null;
      this.openRouterModel = null;
    }
  }

  get openRouterEnabled(): boolean {
    return this.openRouter !== null;
  }

  /** Model for light chat turns and utility calls. */
  get lightModel(): string {
    return this.openRouterModel ?? this.claudeLightModel;
  }

  /** The Claude model a failed light call falls back to. */
  get claudeFallbackModel(): string {
    return this.claudeLightModel;
  }

  static isOpenRouterModel(model: string): boolean {
    return model.includes('/');
  }

  /** Client for a model id; an OpenRouter id without a configured key falls back to Claude's client. */
  clientFor(model: string): LlmClient {
    return LlmClientsService.isOpenRouterModel(model) && this.openRouter
      ? this.openRouter
      : this.anthropic;
  }

  /** The Anthropic client, for Claude-only work. */
  get claude(): LlmClient {
    return this.anthropic;
  }

  /**
   * Non-streaming light call on the light model; if OpenRouter fails it is
   * retried once on the Claude light model, so utility work never breaks
   * because of the cheaper provider.
   */
  async createLight(
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
  ): Promise<LightCallResult> {
    const model = this.lightModel;
    try {
      const message = await this.clientFor(model).messages.create({
        ...params,
        model,
      });
      return { message, model };
    } catch (err) {
      if (!LlmClientsService.isOpenRouterModel(model)) throw err;
      this.logger.warn(
        `OpenRouter light call failed (${(err as Error).message}); retrying on ${this.claudeLightModel}`,
      );
      const message = await this.anthropic.messages.create({
        ...params,
        model: this.claudeLightModel,
      });
      return { message, model: this.claudeLightModel };
    }
  }
}
