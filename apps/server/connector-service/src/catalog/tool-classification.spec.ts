import { classifyTool, STRICTEST_GROUP, toolNameTokens } from './tool-classification';

const write = (group: string) => ({ group, sensitive: true });
const read = { group: 'view', sensitive: false };

describe('classifyTool (fail-closed)', () => {
  it('classifies the hosted Notion MCP tools that used to fall through to `view`', () => {
    expect(classifyTool('notion-create-pages')).toEqual(write('create'));
    expect(classifyTool('notion-update-page')).toEqual(write('edit'));
    expect(classifyTool('notion-move-pages')).toEqual(write('edit'));
    expect(classifyTool('notion-duplicate-page')).toEqual(write('create'));
    expect(classifyTool('notion-create-comment')).toEqual(write('create'));
    expect(classifyTool('notion-search')).toEqual(read);
    expect(classifyTool('notion-fetch')).toEqual(read);
    expect(classifyTool('notion-get-comments')).toEqual(read);
  });

  it('classifies Stripe and GitHub writes as sensitive', () => {
    expect(classifyTool('create_refund')).toEqual(write('create'));
    expect(classifyTool('cancel_subscription')).toEqual(write('delete'));
    expect(classifyTool('finalize_invoice')).toEqual(write('edit'));
    expect(classifyTool('merge_pull_request')).toEqual(write('edit'));
    expect(classifyTool('push_files')).toEqual(write('edit'));
    expect(classifyTool('create_or_update_file')).toEqual(write('edit'));
    expect(classifyTool('list_customers')).toEqual(read);
    expect(classifyTool('retrieve_balance')).toEqual(read);
    expect(classifyTool('get_file_contents')).toEqual(read);
  });

  it('puts tools with no recognisable verb in the strictest group, sensitive', () => {
    expect(STRICTEST_GROUP).toBe('delete');
    expect(classifyTool('run_workflow')).toEqual(write('delete'));
    expect(classifyTool('mystery_tool')).toEqual(write('delete'));
    expect(classifyTool('atlassianUserInfo')).toEqual(write('delete'));
  });

  it('trusts readOnlyHint === true from the MCP server', () => {
    expect(classifyTool('atlassianUserInfo', { readOnlyHint: true })).toEqual(read);
    expect(classifyTool('analyze_issue_with_seer', { readOnlyHint: true })).toEqual(read);
  });

  it('an explicit readOnlyHint: false overrules a read-sounding name', () => {
    expect(classifyTool('search_and_index', { readOnlyHint: false })).toEqual(write('delete'));
    expect(classifyTool('search_threads_x')).toEqual(read);
  });

  it('keeps the explicit overrides (they beat annotations)', () => {
    expect(classifyTool('send_email', { readOnlyHint: true })).toEqual(write('create'));
    expect(classifyTool('create_draft')).toEqual({ group: 'create', sensitive: false });
    expect(classifyTool('suggest_time')).toEqual(read);
    expect(classifyTool('DELETE_FILE')).toEqual(write('delete'));
  });

  it('matches whole words, not substrings (`get_address` is not an `add`)', () => {
    expect(classifyTool('get_address')).toEqual(read);
    expect(classifyTool('get_settings')).toEqual(read);
    expect(classifyTool('get_post')).toEqual(read);
    expect(classifyTool('get_push_settings')).toEqual(read);
    expect(classifyTool('post_message')).toEqual(write('create'));
    expect(classifyTool('get_or_create_user')).toEqual(write('create'));
  });

  it('tokenizes camelCase, kebab, dotted and snake names', () => {
    expect(toolNameTokens('createJiraIssue')).toEqual(['create', 'jira', 'issue']);
    expect(toolNameTokens('getHTTPResponse')).toEqual(['get', 'http', 'response']);
    expect(toolNameTokens('issues.create')).toEqual(['issues', 'create']);
    expect(classifyTool('issues.create')).toEqual(write('create'));
    expect(classifyTool('searchJiraIssuesUsingJql')).toEqual(read);
  });
});
