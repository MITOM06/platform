import { classifyToolActionGroup, ALL_ACTION_GROUPS } from './catalog';

describe('classifyToolActionGroup', () => {
  it('classifies read-like tools as view', () => {
    for (const t of ['list_events', 'search_threads', 'get_file', 'read_page', 'find_user']) {
      expect(classifyToolActionGroup(t)).toBe('view');
    }
  });

  it('classifies outbound/create tools as create', () => {
    for (const t of ['send_email', 'create_draft', 'create_event', 'insert_row', 'post_message']) {
      expect(classifyToolActionGroup(t)).toBe('create');
    }
  });

  it('classifies modify tools as edit', () => {
    for (const t of ['update_event', 'update_page', 'edit_doc', 'rename_file', 'move_item']) {
      expect(classifyToolActionGroup(t)).toBe('edit');
    }
  });

  it('classifies destructive tools as delete', () => {
    for (const t of ['delete_file', 'delete_event', 'remove_member', 'archive_thread']) {
      expect(classifyToolActionGroup(t)).toBe('delete');
    }
  });

  it('is case-insensitive', () => {
    expect(classifyToolActionGroup('DELETE_FILE')).toBe('delete');
    expect(classifyToolActionGroup('Send_Email')).toBe('create');
  });

  it('defaults unknown tools to the least-privileged view', () => {
    expect(classifyToolActionGroup('mystery_tool')).toBe('view');
  });

  it('every classification is a member of ALL_ACTION_GROUPS', () => {
    for (const t of ['delete_x', 'update_x', 'create_x', 'list_x']) {
      expect(ALL_ACTION_GROUPS).toContain(classifyToolActionGroup(t));
    }
  });
});
