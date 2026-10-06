import { McpTool } from '../mcp/mcp-client.service';

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});

const READ_ONLY = { readOnlyHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false };

/** Static Gmail tool definitions (Google has no public remote MCP). */
export const GMAIL_TOOLS: McpTool[] = [
  {
    name: 'send_email',
    description: "Send an email on the user's behalf. `to` is a comma-separated list of addresses.",
    inputSchema: obj(
      { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      ['to', 'subject', 'body'],
    ),
    annotations: WRITE,
  },
  {
    name: 'create_draft',
    description: 'Create a Gmail draft without sending it.',
    inputSchema: obj(
      { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      ['to', 'subject', 'body'],
    ),
    annotations: WRITE,
  },
  {
    name: 'search_threads',
    description:
      'Search the user Gmail threads (Gmail search syntax). Returns up to 10 threads with id, ' +
      'sender, subject, date, message count and a snippet.',
    inputSchema: obj(
      { query: { type: 'string' }, maxResults: { type: 'number', minimum: 1, maximum: 10 } },
      ['query'],
    ),
    annotations: READ_ONLY,
  },
];

/** Static Google Calendar tool definitions. */
export const CALENDAR_TOOLS: McpTool[] = [
  {
    name: 'list_events',
    description:
      'List calendar events (primary calendar), soonest first. Returns title, start/end, ' +
      'location, attendee count and id for up to 25 events. Times are RFC 3339.',
    inputSchema: obj({
      timeMin: { type: 'string' },
      timeMax: { type: 'string' },
      maxResults: { type: 'number', minimum: 1, maximum: 25 },
    }),
    annotations: READ_ONLY,
  },
  {
    name: 'create_event',
    description: 'Create a calendar event. `start`/`end` are RFC 3339 date-times.',
    inputSchema: obj(
      {
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
      },
      ['summary', 'start', 'end'],
    ),
    annotations: WRITE,
  },
  {
    name: 'suggest_time',
    description: 'Suggest the next open slot of a given duration.',
    inputSchema: obj(
      {
        durationMins: { type: 'number' },
        attendees: { type: 'array', items: { type: 'string' } },
        windowStart: { type: 'string' },
        windowEnd: { type: 'string' },
      },
      ['durationMins'],
    ),
    annotations: READ_ONLY,
  },
];
