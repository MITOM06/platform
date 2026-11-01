import { buildSkillOffNote, buildToolNotes, buildWithheldNote } from './withheld-tools';

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

describe('buildSkillOffNote', () => {
  it('is empty when the skill gate dropped nothing', () => {
    expect(buildSkillOffNote([])).toBe('');
  });

  it('names the connected app, its tools and the skill that turns them on', () => {
    const note = buildSkillOffNote(['mcp__calendar__list_events', 'mcp__calendar__create_event']);
    expect(note).toContain('Google Calendar (list_events, create_event; turned on by the Scheduler skill)');
    expect(note).toMatch(/ARE connected/);
    expect(note).toMatch(/turn it on in Skills/);
    expect(note).toMatch(/Never claim you checked/);
    expect(note).toMatch(/earlier in this conversation/);
  });

  it('lists every skill that would unlock a Gmail tool', () => {
    const note = buildSkillOffNote(['mcp__gmail__send_email', 'mcp__gmail__search_threads']);
    expect(note).toContain('Gmail (send_email, search_threads; turned on by the Mail writer or Inbox triage skill)');
  });
});

describe('buildToolNotes', () => {
  it('joins the role and skill notes, skipping the empty one', () => {
    expect(buildToolNotes([], [])).toBe('');
    expect(buildToolNotes([], ['mcp__notion__create_page'])).toBe(buildSkillOffNote(['mcp__notion__create_page']));
    const both = buildToolNotes(['mcp__gmail__send_email'], ['mcp__notion__create_page']);
    expect(both).toContain('role may not run');
    expect(both).toContain('Project keeper skill');
  });
});
