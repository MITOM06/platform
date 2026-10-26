import { McpTool } from '../mcp/mcp-client.service';

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});

const READ_ONLY = { readOnlyHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false };

/**
 * Static Notion tool definitions. Notion's hosted MCP (mcp.notion.com) rejects
 * the OAuth token this connector holds (403 `restricted_resource`: "This token
 * type cannot access Notion MCP"), so Notion is exposed like Gmail/Calendar —
 * MCP-shaped tools backed by the REST API.
 */
export const NOTION_TOOLS: McpTool[] = [
  {
    name: 'search_pages',
    description:
      'Search the Notion pages and data sources shared with this connection, by title. ' +
      'Returns up to 20 results with type, title, id and url.',
    inputSchema: obj({
      query: { type: 'string' },
      type: { type: 'string', enum: ['page', 'data_source'] },
      maxResults: { type: 'number', minimum: 1, maximum: 20 },
    }),
    annotations: READ_ONLY,
  },
  {
    name: 'get_page',
    description: 'Read a Notion page: its title and the text of its top-level blocks.',
    inputSchema: obj({ pageId: { type: 'string' } }, ['pageId']),
    annotations: READ_ONLY,
  },
  {
    name: 'query_data_source',
    description:
      'List the rows (pages) of a Notion data source with their key properties, ' +
      'optionally narrowed by a Notion filter object.',
    inputSchema: obj(
      {
        dataSourceId: { type: 'string' },
        filter: { type: 'object' },
        maxResults: { type: 'number', minimum: 1, maximum: 20 },
      },
      ['dataSourceId'],
    ),
    annotations: READ_ONLY,
  },
  {
    name: 'create_page',
    description:
      'Create a Notion page under a parent page (parentPageId) or as a row of a data source ' +
      '(dataSourceId). Give exactly one parent. `content` becomes one paragraph per line.',
    inputSchema: obj(
      {
        title: { type: 'string' },
        parentPageId: { type: 'string' },
        dataSourceId: { type: 'string' },
        content: { type: 'string' },
      },
      ['title'],
    ),
    annotations: WRITE,
  },
  {
    name: 'update_page',
    description:
      'Update a Notion page: rename it (title) and/or set property values (Notion property JSON).',
    inputSchema: obj(
      { pageId: { type: 'string' }, title: { type: 'string' }, properties: { type: 'object' } },
      ['pageId'],
    ),
    annotations: WRITE,
  },
  {
    name: 'update_page_content',
    description: 'Append text to the end of a Notion page, one paragraph per line (at most 100 lines).',
    inputSchema: obj({ pageId: { type: 'string' }, content: { type: 'string' } }, ['pageId', 'content']),
    annotations: WRITE,
  },
];
