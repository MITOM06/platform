/**
 * Governance classification of a connector tool: which action group it needs
 * on the connection (view/create/edit/delete) and whether it is "sensitive"
 * (needs RUN_SENSITIVE_SKILL).
 *
 * Fail-closed by design. A tool counts as read-only ONLY when
 *   1. an explicit override below says so, or
 *   2. the MCP server marks it `annotations.readOnlyHint === true`, or
 *   3. its name's leading verb is a known read verb and it contains no write verb.
 * Everything else is a write and sensitive; a tool with no recognisable verb
 * (`notion-duplicate-page` was once one of these, `finalize_invoice`,
 * `run_workflow`) lands in the strictest group. Previously an unknown verb
 * defaulted to `view`, so a view-only grant still allowed hosted Notion/Stripe/
 * GitHub writes and Members could run them without RUN_SENSITIVE_SKILL.
 */
export type ActionGroup = 'view' | 'create' | 'edit' | 'delete';

export const ALL_ACTION_GROUPS: readonly ActionGroup[] = ['view', 'create', 'edit', 'delete'];

/** Group for writes whose effect we cannot name. */
export const STRICTEST_GROUP: ActionGroup = 'delete';

/** Subset of the MCP `ToolAnnotations` we act on. */
export interface ToolAnnotationsLike {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
}

export interface ToolClassification {
  group: ActionGroup;
  sensitive: boolean;
}

const w = (group: ActionGroup, sensitive = true): ToolClassification => ({ group, sensitive });
const READ: ToolClassification = { group: 'view', sensitive: false };

/**
 * Explicit per-name overrides (lower-cased bare tool names). They win over
 * annotations and verb heuristics. Kept from the previous SENSITIVE_TOOLS /
 * TOOL_ACTION_GROUP lists.
 */
const OVERRIDES: ReadonlyMap<string, ToolClassification> = new Map([
  // Email
  ['send_email', w('create')],
  ['send_message', w('create')],
  // A draft never leaves the member's mailbox — the safe path the mail-writing
  // skill relies on — so it stays available without RUN_SENSITIVE_SKILL.
  ['create_draft', w('create', false)],
  // Read-only helpers whose names don't start with a read verb
  ['suggest_time', READ],
  ['search_threads', READ],
  ['list_events', READ],
  // Notion page/database writes
  ['create_page', w('create')],
  ['update_page', w('edit')],
  ['create_database', w('create')],
  ['update_database', w('edit')],
  ['create-pages', w('create')],
  ['update-page', w('edit')],
  // Generic external writes
  ['create_event', w('create')],
  ['update_event', w('edit')],
  ['delete_event', w('delete')],
  ['create_file', w('create')],
  ['update_file', w('edit')],
  ['delete_file', w('delete')],
]);

/** Bare names tagged sensitive by an explicit override (back-compat export). */
export const SENSITIVE_TOOLS: ReadonlySet<string> = new Set(
  [...OVERRIDES.entries()].filter(([, c]) => c.sensitive).map(([name]) => name),
);

// Unambiguous write verbs: any occurrence makes the tool a write.
const DELETE_VERBS = new Set([
  'delete', 'remove', 'revoke', 'cancel', 'destroy', 'purge', 'erase', 'unpublish',
  'unsubscribe', 'uninstall', 'wipe',
]);
const EDIT_VERBS = new Set([
  'update', 'edit', 'modify', 'patch', 'move', 'rename', 'replace', 'assign', 'unassign',
  'reassign', 'reopen', 'resolve', 'approve', 'reject', 'enable', 'disable', 'activate',
  'deactivate', 'toggle', 'configure', 'reorder', 'restore', 'unlock', 'unpin', 'unstar',
  'unlabel', 'finalize', 'complete', 'accept', 'decline', 'respond', 'unlink', 'upsert',
  'overwrite', 'close', 'convert',
]);
const CREATE_VERBS = new Set([
  'create', 'insert', 'add', 'send', 'compose', 'publish', 'duplicate', 'clone', 'fork',
  'invite', 'submit', 'append', 'write', 'generate',
]);
// Words that are verbs at the start of a name (`push_files`, `post_message`)
// but usually nouns after a read verb (`get_push_settings`, `get_post`): they
// only count when they are the leading verb-like token.
const AMBIGUOUS_WRITES: ReadonlyMap<string, ActionGroup> = new Map([
  ['archive', 'delete'], ['trash', 'delete'], ['void', 'delete'], ['drop', 'delete'],
  ['set', 'edit'], ['mark', 'edit'], ['label', 'edit'], ['tag', 'edit'], ['pin', 'edit'],
  ['star', 'edit'], ['link', 'edit'], ['sort', 'edit'], ['merge', 'edit'], ['push', 'edit'],
  ['change', 'edit'], ['lock', 'edit'], ['transition', 'edit'],
  ['post', 'create'], ['draft', 'create'], ['comment', 'create'], ['reply', 'create'],
  ['book', 'create'], ['schedule', 'create'], ['request', 'create'], ['copy', 'create'],
  ['share', 'create'], ['new', 'create'], ['note', 'create'], ['message', 'create'],
  ['email', 'create'], ['file', 'create'], ['report', 'create'], ['record', 'create'],
  ['log', 'create'], ['order', 'create'], ['upload', 'create'], ['import', 'create'],
]);
const READ_VERBS = new Set([
  'get', 'list', 'search', 'find', 'read', 'fetch', 'query', 'view', 'describe', 'lookup',
  'look', 'retrieve', 'show', 'count', 'preview', 'inspect', 'browse', 'download', 'whoami',
  'ping',
]);

/** Split snake/kebab/dotted/camelCase names into lower-case word tokens. */
export function toolNameTokens(name: string): string[] {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function classifyTool(
  name: string,
  annotations?: ToolAnnotationsLike | null,
): ToolClassification {
  const override = OVERRIDES.get(String(name ?? '').toLowerCase());
  if (override) return override;
  if (annotations?.readOnlyHint === true) return READ;

  const tokens = toolNameTokens(name);
  if (tokens.some((t) => DELETE_VERBS.has(t))) return w('delete');
  if (tokens.some((t) => EDIT_VERBS.has(t))) return w('edit');
  if (tokens.some((t) => CREATE_VERBS.has(t))) return w('create');

  // The leading verb-like token decides between a read and an ambiguous write.
  const lead = tokens.find((t) => READ_VERBS.has(t) || AMBIGUOUS_WRITES.has(t));
  if (lead && AMBIGUOUS_WRITES.has(lead)) return w(AMBIGUOUS_WRITES.get(lead)!);
  // An explicit `readOnlyHint: false` overrules a read-sounding name.
  if (lead && annotations?.readOnlyHint !== false) return READ;
  return w(STRICTEST_GROUP);
}

/** Back-compat helpers (name-only, no annotations). */
export function classifyToolActionGroup(toolName: string): ActionGroup {
  return classifyTool(toolName).group;
}

export function isSensitiveTool(toolName: string): boolean {
  return classifyTool(toolName).sensitive;
}
