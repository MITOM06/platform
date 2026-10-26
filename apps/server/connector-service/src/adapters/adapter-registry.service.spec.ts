import { AdapterRegistryService } from './adapter-registry.service';

describe('AdapterRegistryService', () => {
  const remote = { listTools: jest.fn(), callTool: jest.fn() } as any;
  const google = { listTools: jest.fn(), callTool: jest.fn() } as any;
  const notion = { listTools: jest.fn(), callTool: jest.fn() } as any;
  const reg = new AdapterRegistryService(remote, google, notion);

  it('notion → notion-rest adapter (the hosted MCP rejects the catalog OAuth token)', () => {
    expect(reg.forProvider('notion')).toBe(notion);
  });

  it('gmail → google-rest adapter', () => {
    expect(reg.forProvider('gmail')).toBe(google);
  });

  it('calendar → google-rest adapter', () => {
    expect(reg.forProvider('calendar')).toBe(google);
  });

  it('custom:* → remote-mcp adapter', () => {
    expect(reg.forProvider('custom:abc123')).toBe(remote);
  });

  it('unknown provider → remote-mcp adapter (default)', () => {
    expect(reg.forProvider('whatever')).toBe(remote);
  });
});
