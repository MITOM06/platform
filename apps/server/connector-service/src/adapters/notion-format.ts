import { ToolExecutionError } from '../internal/tool-errors';

/**
 * Pure Notion-JSON ↔ text helpers for the Notion REST adapter. No I/O: the
 * adapter owns HTTP, tokens and errors.
 */

export type RichText = { plain_text?: string };

export type PropValue = { type?: string; title?: RichText[]; [k: string]: unknown };

export interface NotionObject {
  object?: string;
  id?: string;
  url?: string;
  title?: RichText[];
  properties?: Record<string, PropValue>;
}

export type NotionBlock = { type?: string; [k: string]: unknown };

const plain = (rt?: RichText[]): string => (rt ?? []).map((t) => t.plain_text ?? '').join('');

const names = (list: unknown): string =>
  ((list as Array<{ name?: string }> | undefined) ?? []).map((o) => o.name ?? '?').join(', ');

/** Compact text for a row property; null when empty or not summarised (e.g. the title). */
export function propText(p: PropValue): string | null {
  switch (p.type) {
    case 'rich_text':
      return plain(p.rich_text as RichText[]) || null;
    case 'number':
      return p.number == null ? null : String(p.number);
    case 'select':
    case 'status':
      return (p[p.type] as { name?: string } | null)?.name ?? null;
    case 'multi_select':
      return names(p.multi_select) || null;
    case 'people':
      return names(p.people) || null;
    case 'date': {
      const d = p.date as { start?: string; end?: string } | null;
      if (!d?.start) return null;
      return d.end ? `${d.start} → ${d.end}` : d.start;
    }
    case 'checkbox':
      return String(p.checkbox);
    default:
      return null;
  }
}

/** Title of a page (its `title`-typed property) or data source (top-level `title`). */
export function titleOf(o: NotionObject): string {
  if (Array.isArray(o.title)) return plain(o.title) || '(untitled)';
  const prop = Object.values(o.properties ?? {}).find((p) => p.type === 'title');
  return plain(prop?.title) || '(untitled)';
}

/** Notion caps each rich text object at 2000 characters, so longer text is split. */
const MAX_TEXT = 2000;
export const richText = (content: string) => {
  const parts: Array<{ type: string; text: { content: string } }> = [];
  for (let i = 0; i < content.length; i += MAX_TEXT) {
    parts.push({ type: 'text', text: { content: content.slice(i, i + MAX_TEXT) } });
  }
  return parts;
};

/** One paragraph block per non-empty line. */
export const paragraphs = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(line) },
    }));

const BLOCK_PREFIX: Record<string, string> = {
  heading_1: '# ',
  heading_2: '## ',
  heading_3: '### ',
  bulleted_list_item: '- ',
  numbered_list_item: '1. ',
  quote: '> ',
};

/** One line of plain text for a block; '' for blocks without rich text. */
export function blockText(b: NotionBlock): string {
  const body = (b.type ? b[b.type] : undefined) as { rich_text?: RichText[]; checked?: boolean } | undefined;
  const text = plain(body?.rich_text);
  if (!text) return '';
  if (b.type === 'to_do') return `${body?.checked ? '[x]' : '[ ]'} ${text}`;
  return `${BLOCK_PREFIX[b.type ?? ''] ?? ''}${text}`;
}

/** Notion's machine error code (`object_not_found`, `restricted_resource`), never its message. */
export function notionErrorReason(body: string): string | undefined {
  try {
    const code = (JSON.parse(body) as { code?: unknown })?.code;
    if (typeof code === 'string' && /^[a-z_]{1,64}$/.test(code)) return code;
  } catch {
    // not JSON
  }
  return undefined;
}

const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** A Notion page / data source id. It is interpolated into a URL path, so anything else is refused. */
export function notionId(value: unknown, field: string): string {
  if (typeof value === 'string' && NOTION_ID.test(value)) return value;
  throw new ToolExecutionError('INVALID_INPUT', `${field} must be a Notion id (32 hex characters, dashes optional).`);
}
