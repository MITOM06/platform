import { classifyTool } from '../catalog/tool-classification';
import { NOTION_TOOLS } from './notion-tools';

// Governance reads the tool name and its annotations. Every Notion REST tool must
// land where a member would expect: reads are open, writes need an action-group
// grant and RUN_SENSITIVE_SKILL, and an AI write is held for in-chat confirmation.
describe('Notion REST tools governance', () => {
  const classes = Object.fromEntries(NOTION_TOOLS.map((t) => [t.name, classifyTool(t.name, t.annotations)]));

  it('keeps the three read tools open to everyone', () => {
    for (const name of ['search_pages', 'get_page', 'query_data_source']) {
      expect(classes[name]).toEqual({ group: 'view', sensitive: false });
    }
  });

  it('makes each write a sensitive action in the right group', () => {
    expect(classes.create_page).toEqual({ group: 'create', sensitive: true });
    expect(classes.update_page).toEqual({ group: 'edit', sensitive: true });
    expect(classes.update_page_content).toEqual({ group: 'edit', sensitive: true });
  });
});
