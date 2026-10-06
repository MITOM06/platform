import {
  buildToolName,
  customProviderId,
  customServerIdOf,
  exposedToolSegment,
  isCustomProvider,
  parseToolName,
  TOOL_NAME_PATTERN,
} from './tool-naming';

const SERVER_ID = '6650c0ffee0123456789abcd';
const CUSTOM = customProviderId(SERVER_ID);

describe('tool naming', () => {
  it('custom providers no longer contain the `:` that broke the Anthropic name pattern', () => {
    const name = buildToolName(CUSTOM, 'search')!;
    expect(name).toBe(`mcp__custom_${SERVER_ID}__search`);
    expect(name).toMatch(TOOL_NAME_PATTERN);
    expect(name).not.toContain(':');
  });

  it('keeps already-valid names unchanged (built-in/directory tools are stable)', () => {
    expect(buildToolName('notion', 'notion-create-pages')).toBe('mcp__notion__notion-create-pages');
    expect(buildToolName('gmail', 'send_email')).toBe('mcp__gmail__send_email');
  });

  it('sanitizes invalid characters deterministically and stays within 64 chars', () => {
    const a = buildToolName(CUSTOM, 'issues.create (v2)')!;
    const b = buildToolName(CUSTOM, 'issues.create (v2)')!;
    expect(a).toBe(b);
    expect(a).toMatch(TOOL_NAME_PATTERN);
    expect(a.length).toBeLessThanOrEqual(64);
    expect(a).toMatch(/^mcp__custom_[0-9a-f]{24}__issues_create_v2_[0-9a-f]{8}$/);
  });

  it('truncates long names with a hash suffix that keeps them unique', () => {
    const long1 = 'get_all_repository_pull_request_review_comments_for_user';
    const long2 = 'get_all_repository_pull_request_review_comments_for_team';
    const n1 = buildToolName(CUSTOM, long1)!;
    const n2 = buildToolName(CUSTOM, long2)!;
    expect(n1.length).toBeLessThanOrEqual(64);
    expect(n2.length).toBeLessThanOrEqual(64);
    expect(n1).not.toBe(n2);
    expect(n1).toMatch(TOOL_NAME_PATTERN);
  });

  it('disambiguates names that sanitize to the same text', () => {
    expect(exposedToolSegment(CUSTOM, 'a.b')).not.toBe(exposedToolSegment(CUSTOM, 'a b'));
    expect(exposedToolSegment(CUSTOM, 'a_b')).toBe('a_b');
  });

  it('produces a valid name even for an empty or all-symbol remote name', () => {
    expect(buildToolName(CUSTOM, '...')).toMatch(/^mcp__custom_[0-9a-f]{24}__[0-9a-f]{8}$/);
    expect(buildToolName(CUSTOM, '')).toMatch(TOOL_NAME_PATTERN);
  });

  it('refuses a provider id that leaves no room for the tool part', () => {
    expect(buildToolName('x'.repeat(60), 'search')).toBeNull();
    expect(buildToolName('bad provider', 'search')).toBeNull();
  });

  it('parses new and legacy custom names to the same provider', () => {
    expect(parseToolName(`mcp__custom_${SERVER_ID}__search`)).toEqual({ provider: CUSTOM, tool: 'search' });
    expect(parseToolName(`mcp__custom:${SERVER_ID}__search`)).toEqual({ provider: CUSTOM, tool: 'search' });
    expect(parseToolName('mcp__notion__a__b')).toEqual({ provider: 'notion', tool: 'a__b' });
    expect(parseToolName('mcp____x')).toBeNull();
    expect(parseToolName('mcp__notion__')).toBeNull();
    expect(parseToolName('search')).toBeNull();
    expect(parseToolName({} as unknown as string)).toBeNull();
  });

  it('recognizes custom providers in both forms', () => {
    expect(isCustomProvider(CUSTOM)).toBe(true);
    expect(isCustomProvider(`custom:${SERVER_ID}`)).toBe(true);
    expect(isCustomProvider('custom-crm')).toBe(false);
    expect(customServerIdOf(CUSTOM)).toBe(SERVER_ID);
    expect(customServerIdOf(`custom:${SERVER_ID}`)).toBe(SERVER_ID);
    expect(customServerIdOf('notion')).toBeNull();
  });
});
