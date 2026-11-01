import type {
  McpSdkServerConfigWithInstance,
  Options,
  Query,
  SdkMcpToolDefinition,
} from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';

/** The three Agent SDK entry points the CLI provider uses. */
export interface AgentSdk {
  query(params: { prompt: string; options?: Options }): Query;
  tool<Schema extends ZodRawShape>(
    name: string,
    description: string,
    inputSchema: Schema,
    handler: (args: Record<string, unknown>, extra: unknown) => Promise<CallToolResult>,
  ): SdkMcpToolDefinition<Schema>;
  createSdkMcpServer(options: {
    name: string;
    version?: string;
    tools?: SdkMcpToolDefinition<ZodRawShape>[];
  }): McpSdkServerConfigWithInstance;
}

export type AgentSdkLoader = () => Promise<AgentSdk>;

// The SDK is ESM-only and this service compiles to CommonJS: a plain `import()`
// would be rewritten to `require()` by tsc and fail with ERR_REQUIRE_ESM on
// Node 20. `new Function` keeps a real dynamic import.
const importEsm = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

let cached: Promise<AgentSdk> | null = null;

/** Load `@anthropic-ai/claude-agent-sdk` once per process. */
export const loadAgentSdk: AgentSdkLoader = () => {
  cached ??= importEsm('@anthropic-ai/claude-agent-sdk') as Promise<AgentSdk>;
  return cached;
};
