import { DirectoryAuthMode, DirectoryTier } from './schemas/mcp-directory-entry.schema';

/**
 * Shape of a seed entry (subset of McpDirectoryEntry). `builtin` is forced true
 * at upsert time; createdBy stays unset.
 */
export interface DirectorySeedEntry {
  slug: string;
  name: string;
  icon: string;
  description: string;
  mcpUrl: string;
  authMode: DirectoryAuthMode;
  tier: DirectoryTier;
  scopes?: string[];
  available?: boolean;
}

/**
 * Well-known public MCP servers shown 1-click in the directory. These are
 * upserted idempotently on boot (builtin:true). Most support MCP-native OAuth
 * (Dynamic Client Registration + PKCE) so no per-provider operator credentials
 * are required; entries that don't will simply fail discovery and can be
 * adjusted by an admin. Endpoints follow each vendor's published MCP URL.
 */
export const DIRECTORY_SEED: DirectorySeedEntry[] = [
  {
    slug: 'notion',
    name: 'Notion',
    icon: 'notion',
    description: 'Create and update Notion pages and databases from chat.',
    mcpUrl: 'https://mcp.notion.com/mcp',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'linear',
    name: 'Linear',
    icon: 'linear',
    description: 'Manage Linear issues, projects and cycles.',
    mcpUrl: 'https://mcp.linear.app/mcp',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'sentry',
    name: 'Sentry',
    icon: 'sentry',
    description: 'Inspect Sentry issues and error events.',
    mcpUrl: 'https://mcp.sentry.dev/mcp',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'atlassian',
    name: 'Atlassian',
    icon: 'atlassian',
    description: 'Work with Jira issues and Confluence pages.',
    mcpUrl: 'https://mcp.atlassian.com/v1/sse',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'github',
    name: 'GitHub',
    icon: 'github',
    description: 'Browse repositories, issues and pull requests.',
    mcpUrl: 'https://api.githubcopilot.com/mcp/',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    icon: 'stripe',
    description: 'Query Stripe customers, payments and invoices.',
    mcpUrl: 'https://mcp.stripe.com',
    authMode: 'mcp-oauth',
    tier: 'workspace',
  },
  {
    slug: 'huggingface',
    name: 'Hugging Face',
    icon: 'huggingface',
    description: 'Search models, datasets and Spaces on the Hub.',
    mcpUrl: 'https://huggingface.co/mcp',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
  {
    slug: 'asana',
    name: 'Asana',
    icon: 'asana',
    description: 'Manage Asana tasks, projects and portfolios.',
    mcpUrl: 'https://mcp.asana.com/sse',
    authMode: 'mcp-oauth',
    tier: 'both',
  },
];
