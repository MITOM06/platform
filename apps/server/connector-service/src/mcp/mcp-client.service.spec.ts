import { McpClientService, McpAuth } from './mcp-client.service';

class FakeClient {
  connected = false;
  closed = false;
  constructor(public readonly tag: string) {}
  async connect() {
    this.connected = true;
  }
  async listTools() {
    return {
      tools: [
        {
          name: 'create_page',
          description: 'Create a page',
          inputSchema: { type: 'object', properties: { title: {} } },
        },
        {
          name: 'search',
          description: 'Search',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };
  }
  async callTool(params: { name: string; arguments: unknown }) {
    return {
      content: [
        { type: 'text', text: `called ${params.name} ` },
        { type: 'text', text: 'with result' },
      ],
    };
  }
  async close() {
    this.closed = true;
  }
}

class TestableMcpClientService extends McpClientService {
  public created: FakeClient[] = [];
  protected async createClient(url: string, _auth: McpAuth): Promise<any> {
    const c = new FakeClient(url);
    await c.connect();
    this.created.push(c);
    return c;
  }
}

describe('McpClientService', () => {
  let svc: TestableMcpClientService;
  const auth: McpAuth = { type: 'bearer', token: 'tkn' };

  beforeEach(() => {
    svc = new TestableMcpClientService();
  });

  it('maps SDK tools to McpTool[]', async () => {
    const tools = await svc.listTools('https://mcp.example/sse', auth);
    expect(tools.map((t) => t.name)).toEqual(['create_page', 'search']);
    expect(tools[0].inputSchema).toEqual({
      type: 'object',
      properties: { title: {} },
    });
  });

  it('joins text content from callTool', async () => {
    const out = await svc.callTool('https://mcp.example/sse', auth, 'create_page', {
      title: 'X',
    });
    expect(out).toBe('called create_page with result');
  });

  it('caches the client by url+token (one client across calls)', async () => {
    await svc.listTools('https://mcp.example/sse', auth);
    await svc.callTool('https://mcp.example/sse', auth, 'search', {});
    expect(svc.created.length).toBe(1);
  });

  it('closes all clients on module destroy', async () => {
    await svc.listTools('https://mcp.example/sse', auth);
    await svc.onModuleDestroy();
    expect(svc.created[0].closed).toBe(true);
  });
});
