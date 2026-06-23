import {
  SettingsInvalidatorService,
  AI_SETTINGS_INVALIDATE_CHANNEL,
} from './settings-invalidator.service';
import { SettingsService } from './settings.service';

describe('SettingsInvalidatorService', () => {
  let subscribe: jest.Mock;
  let on: jest.Mock;
  let messageHandler: (channel: string, message: string) => void;
  let invalidate: jest.Mock;
  let service: SettingsInvalidatorService;

  beforeEach(async () => {
    subscribe = jest.fn().mockResolvedValue(1);
    on = jest.fn((event: string, handler: any) => {
      if (event === 'message') messageHandler = handler;
    });
    invalidate = jest.fn();
    const client = { subscribe, on } as any;
    const settings = { invalidate } as unknown as SettingsService;
    service = new SettingsInvalidatorService(client, settings);
    await service.onApplicationBootstrap();
  });

  it('subscribes to the ai:settings:invalidate channel on bootstrap', () => {
    expect(subscribe).toHaveBeenCalledWith(AI_SETTINGS_INVALIDATE_CHANNEL);
  });

  it('invalidates the cache on a message for its channel', () => {
    messageHandler(AI_SETTINGS_INVALIDATE_CHANNEL, '{"reason":"workspace.update"}');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('ignores messages on other channels (e.g. kb:process)', () => {
    messageHandler('kb:process', '{}');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not throw when subscribe fails (logs and continues)', async () => {
    subscribe.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
