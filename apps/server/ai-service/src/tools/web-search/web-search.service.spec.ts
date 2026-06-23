import { ConfigService } from '@nestjs/config';
import { WebSearchService } from './web-search.service';
import { GenericSearchProvider } from './generic-search.provider';
import { AnthropicWebSearchProvider } from './anthropic-web-search.provider';
import { WebSearchProvider } from './web-search-provider.interface';

function makeConfig(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.webSearch.enabled': true,
    'config.webSearch.maxResults': 5,
    'config.webSearch.provider': 'generic',
    ...over,
  };
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

function fakeProvider(name: string, configured: boolean): WebSearchProvider {
  return {
    name,
    isConfigured: () => configured,
    search: jest.fn().mockResolvedValue([]),
  };
}

describe('WebSearchService', () => {
  it('is available when enabled and the generic provider is configured', () => {
    const svc = new WebSearchService(
      makeConfig(),
      fakeProvider('generic', true) as GenericSearchProvider,
      fakeProvider('anthropic', false) as AnthropicWebSearchProvider,
    );
    expect(svc.isAvailable()).toBe(true);
  });

  it('is NOT available when disabled via config even if a provider is configured', () => {
    const svc = new WebSearchService(
      makeConfig({ 'config.webSearch.enabled': false }),
      fakeProvider('generic', true) as GenericSearchProvider,
      fakeProvider('anthropic', false) as AnthropicWebSearchProvider,
    );
    expect(svc.isAvailable()).toBe(false);
  });

  it('is NOT available when the selected provider is unconfigured (no key)', () => {
    const svc = new WebSearchService(
      makeConfig(),
      fakeProvider('generic', false) as GenericSearchProvider,
      fakeProvider('anthropic', false) as AnthropicWebSearchProvider,
    );
    expect(svc.isAvailable()).toBe(false);
  });

  it('selects the anthropic provider when configured to (still a no-op stub)', () => {
    const anthropic = fakeProvider('anthropic', false) as AnthropicWebSearchProvider;
    const svc = new WebSearchService(
      makeConfig({ 'config.webSearch.provider': 'anthropic' }),
      fakeProvider('generic', true) as GenericSearchProvider,
      anthropic,
    );
    // anthropic stub reports not configured → not available.
    expect(svc.isAvailable()).toBe(false);
  });

  it('returns [] from search when not available without calling the provider', async () => {
    const generic = fakeProvider('generic', false) as GenericSearchProvider;
    const svc = new WebSearchService(
      makeConfig(),
      generic,
      fakeProvider('anthropic', false) as AnthropicWebSearchProvider,
    );
    expect(await svc.search('q', 5)).toEqual([]);
    expect(generic.search).not.toHaveBeenCalled();
  });
});
