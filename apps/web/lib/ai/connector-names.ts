/**
 * Display names for connector providers and AI tools.
 *
 * Tool names are machine ids — `mcp__<provider>__<tool>` where `provider` is a
 * catalog id, a directory slug or `custom_<24hex>` — and must never reach the UI
 * (.claude/rules/no-raw-system-data-in-ui.md). Providers resolve to the name the
 * catalog / directory / custom-MCP list gives them; anything unknown becomes a
 * localized generic label chosen by the caller (`null` here).
 */

/** Names of the built-in catalog connectors, used before the catalog has loaded. */
const BUILTIN_PROVIDER_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  calendar: 'Google Calendar',
  drive: 'Google Drive',
  notion: 'Notion',
}

/** A `{ id → name }` source (catalog entries, directory entries, custom MCP servers). */
export interface NamedEntry {
  id: string
  name: string
}

export interface ProviderNameSources {
  catalog?: ReadonlyArray<NamedEntry>
  /** Directory entries are matched by `slug`. */
  directory?: ReadonlyArray<{ slug: string; name: string }>
  /** Custom MCP servers: provider `custom_<id>`. */
  customMcp?: ReadonlyArray<NamedEntry>
}

const CUSTOM_PREFIX = 'custom_'

/** True for a custom MCP provider id (`custom_<hex>`, legacy `custom:<hex>`). */
export function isCustomProvider(provider: string | undefined | null): boolean {
  return !!provider && (provider.startsWith(CUSTOM_PREFIX) || provider.startsWith('custom:'))
}

/** Human name of a connector provider, or `null` when it is unknown (caller localizes). */
export function providerDisplayName(
  provider: string | undefined | null,
  sources: ProviderNameSources = {},
): string | null {
  if (!provider) return null
  if (isCustomProvider(provider)) {
    const id = provider.slice(CUSTOM_PREFIX.length)
    const custom = sources.customMcp?.find((c) => c.id === id)
    return custom?.name?.trim() || null
  }
  const fromCatalog = sources.catalog?.find((c) => c.id === provider)?.name
  if (fromCatalog?.trim()) return fromCatalog.trim()
  const fromDirectory = sources.directory?.find((d) => d.slug === provider)?.name
  if (fromDirectory?.trim()) return fromDirectory.trim()
  return BUILTIN_PROVIDER_NAMES[provider] ?? null
}

/** Provider segment of a namespaced connector tool (`mcp__<provider>__<tool>`). */
export function providerOfTool(toolName: string | undefined | null): string | null {
  if (!toolName || !toolName.startsWith('mcp__')) return null
  const rest = toolName.slice('mcp__'.length)
  const sep = rest.indexOf('__')
  return sep > 0 ? rest.slice(0, sep) : null
}

/** Built-in (non-connector) AI tools → `chat.*` label keys. */
export const BUILTIN_TOOL_LABEL_KEYS: Record<string, string> = {
  search_messages: 'toolSearchMessages',
  get_user_info: 'toolGetUserInfo',
  search_knowledge_base: 'toolSearchKnowledgeBase',
  summarize_conversation: 'toolSummarizeConversation',
  create_reminder: 'toolCreateReminder',
  web_search: 'toolWebSearch',
  remember_fact: 'toolRememberFact',
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * Localized label of a tool call for the trace / tool list: built-in tools have
 * their own label, a connector tool shows the connector's name, anything else a
 * generic label. Never the raw tool id.
 */
export function toolDisplayLabel(
  toolName: string | undefined | null,
  t: Translate,
  sources: ProviderNameSources = {},
): string {
  if (toolName && BUILTIN_TOOL_LABEL_KEYS[toolName]) return t(BUILTIN_TOOL_LABEL_KEYS[toolName])
  const provider = providerOfTool(toolName)
  if (provider) {
    const name = providerDisplayName(provider, sources)
    return name ?? t('aiToolConnector')
  }
  return t('aiToolGeneric')
}

/** A tool identifier made readable, as on mobile (`humanizeToolName`): `search_threads` → `Search threads`. */
export function humanizeToolName(raw: string): string {
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.:]+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : raw
}

/**
 * Trace label of a tool call. A connector tool reads "<Tool> on <Connector>" (as on
 * mobile, `aiToolDisplayName`), so the trace says which tool ran — still never the raw
 * `mcp__…` id; other tools keep {@link toolDisplayLabel}.
 */
export function toolCallLabel(
  toolName: string | undefined | null,
  t: Translate,
  sources: ProviderNameSources = {},
): string {
  const provider = providerOfTool(toolName)
  const tool = provider && toolName ? toolName.slice(`mcp__${provider}__`.length) : ''
  if (!tool) return toolDisplayLabel(toolName, t, sources)
  return t('aiToolOnConnector', {
    tool: humanizeToolName(tool),
    connector: toolDisplayLabel(toolName, t, sources),
  })
}
