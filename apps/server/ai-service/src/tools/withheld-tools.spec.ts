import { buildWithheldNote } from './withheld-tools';

describe('buildWithheldNote', () => {
  it('is empty when the role withholds nothing', () => {
    expect(buildWithheldNote([])).toBe('');
  });

  it('names each connected app by the name users know, with its withheld actions', () => {
    const note = buildWithheldNote([
      'mcp__gmail__send_email',
      'mcp__gmail__create_draft',
      'mcp__calendar__create_event',
    ]);
    expect(note).toContain('Gmail (send_email, create_draft); Google Calendar (create_event)');
    expect(note).toMatch(/ARE connected/);
    expect(note).toMatch(/administrator can grant/);
    expect(note).toMatch(/overrides any instruction to tell them to connect or reconnect/);
  });

  it('labels a custom MCP server generically and skips malformed names', () => {
    const note = buildWithheldNote(['mcp__custom_65f0__create_ticket', 'not_a_connector_tool']);
    expect(note).toContain('a custom connector (create_ticket)');
    expect(note).not.toContain('not_a_connector_tool');
  });
});
