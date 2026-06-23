import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_SUBSCRIBER } from '../redis/redis.constants';
import { SettingsService } from './settings.service';

/** Channel auth-service publishes on after an aiSettings admin save. */
export const AI_SETTINGS_INVALIDATE_CHANNEL = 'ai:settings:invalidate';

/**
 * Subscribes to `ai:settings:invalidate` on the shared subscriber connection and
 * drops the in-memory AI-settings cache on any message — so an admin change in
 * auth-service takes effect on the next AI request with no restart. Mirrors the
 * RedisSubscriberService pattern; uses a dedicated message handler so it never
 * interferes with the kb:* subscriber on the same connection.
 */
@Injectable()
export class SettingsInvalidatorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsInvalidatorService.name);

  constructor(
    @Inject(REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly settingsService: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.subscribe(AI_SETTINGS_INVALIDATE_CHANNEL);
      this.logger.log(`Subscribed to Redis channel: ${AI_SETTINGS_INVALIDATE_CHANNEL}`);
    } catch (err) {
      this.logger.error(
        `Failed to subscribe to ${AI_SETTINGS_INVALIDATE_CHANNEL}: ${(err as Error).message}`,
      );
    }

    // Additive listener — the connection is shared with kb:* handlers, so we
    // filter by channel and only act on ours. The payload is opaque (any
    // message busts the singleton cache).
    this.client.on('message', (channel: string) => {
      if (channel === AI_SETTINGS_INVALIDATE_CHANNEL) {
        this.settingsService.invalidate();
      }
    });
  }
}
