import { Injectable } from '@nestjs/common';
import { findCatalogEntry } from '../catalog/catalog';
import { ProviderAdapter } from './provider-adapter.interface';
import { RemoteMcpAdapter } from './remote-mcp.adapter';
import { GoogleRestAdapter } from './google-rest.adapter';

/**
 * Resolves the right {@link ProviderAdapter} for a provider id. Custom MCP
 * servers (`custom:<id>`) and remote-mcp catalog entries (Notion) use the
 * remote-mcp adapter; `google-rest` catalog entries (Gmail/Calendar) use the
 * Google REST adapter.
 */
@Injectable()
export class AdapterRegistryService {
  constructor(
    private readonly remoteMcp: RemoteMcpAdapter,
    private readonly googleRest: GoogleRestAdapter,
  ) {}

  forProvider(provider: string): ProviderAdapter {
    if (provider.startsWith('custom:')) return this.remoteMcp;
    const entry = findCatalogEntry(provider);
    if (entry?.adapter === 'google-rest') return this.googleRest;
    return this.remoteMcp;
  }
}
