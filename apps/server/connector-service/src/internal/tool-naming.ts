import { createHash } from 'crypto';

/**
 * Tool names handed to ai-service (and through it to the Anthropic API, which
 * requires `^[a-zA-Z0-9_-]{1,64}$` and unique names) and to Bot Factory.
 *
 *   mcp__<provider>__<tool>
 *
 *  - `<provider>`: a catalog id (`gmail`), a directory slug (`linear`) or
 *    `custom_<objectId>` for a custom MCP server. The old `custom:<id>` form
 *    broke the pattern (the `:`) and made every AI request of its owner fail.
 *  - `<tool>`: the remote tool name when it is already valid and fits; otherwise
 *    a deterministic sanitized form `<cleaned prefix>_<8 hex of sha256(original)>`.
 *    The original remote name is recovered at call time by re-listing the
 *    server's tools (see InternalService.resolveTool).
 */
export const TOOL_PREFIX = 'mcp__';
export const TOOL_SEP = '__';
export const MAX_TOOL_NAME_LENGTH = 64;
export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const CUSTOM_PROVIDER_PREFIX = 'custom_';
/** Pre-fix custom provider form, still accepted on calls for in-flight requests. */
export const LEGACY_CUSTOM_PROVIDER_PREFIX = 'custom:';

const SEGMENT_CHARS = /^[A-Za-z0-9_-]+$/;
const HASH_LENGTH = 8;
/** Below this the tool part could no longer be both readable and unique. */
const MIN_TOOL_SEGMENT = HASH_LENGTH;

export function customProviderId(serverId: string): string {
  return `${CUSTOM_PROVIDER_PREFIX}${serverId}`;
}

export function isCustomProvider(provider: string): boolean {
  return (
    provider.startsWith(CUSTOM_PROVIDER_PREFIX) ||
    provider.startsWith(LEGACY_CUSTOM_PROVIDER_PREFIX)
  );
}

/** The custom MCP server id inside a `custom_<id>` (or legacy `custom:<id>`) provider. */
export function customServerIdOf(provider: string): string | null {
  if (provider.startsWith(CUSTOM_PROVIDER_PREFIX)) return provider.slice(CUSTOM_PROVIDER_PREFIX.length) || null;
  if (provider.startsWith(LEGACY_CUSTOM_PROVIDER_PREFIX)) {
    return provider.slice(LEGACY_CUSTOM_PROVIDER_PREFIX.length) || null;
  }
  return null;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, HASH_LENGTH);
}

/**
 * The `<tool>` part exposed for `remoteName` under `provider`, or null when the
 * provider id itself leaves no room for a usable tool name (or is invalid).
 */
export function exposedToolSegment(provider: string, remoteName: string): string | null {
  if (!SEGMENT_CHARS.test(provider)) return null;
  const budget = MAX_TOOL_NAME_LENGTH - TOOL_PREFIX.length - provider.length - TOOL_SEP.length;
  if (budget < MIN_TOOL_SEGMENT) return null;
  const name = String(remoteName ?? '');
  if (name && SEGMENT_CHARS.test(name) && name.length <= budget) return name;
  const hash = shortHash(name);
  const room = budget - HASH_LENGTH - 1;
  const cleaned = name
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^[_-]+/, '')
    .slice(0, Math.max(0, room))
    .replace(/[_-]+$/, '');
  return cleaned ? `${cleaned}_${hash}` : hash;
}

/** Full namespaced name, or null when it cannot be made valid. */
export function buildToolName(provider: string, remoteName: string): string | null {
  const segment = exposedToolSegment(provider, remoteName);
  if (!segment) return null;
  const full = `${TOOL_PREFIX}${provider}${TOOL_SEP}${segment}`;
  return TOOL_NAME_PATTERN.test(full) ? full : null;
}

/**
 * Split `mcp__<provider>__<tool>`. The provider never contains `__`, so the
 * first separator ends it; the tool part may itself contain `__`. A legacy
 * `custom:<id>` provider is normalised to `custom_<id>`.
 */
export function parseToolName(name: unknown): { provider: string; tool: string } | null {
  if (typeof name !== 'string' || !name.startsWith(TOOL_PREFIX)) return null;
  const rest = name.slice(TOOL_PREFIX.length);
  const idx = rest.indexOf(TOOL_SEP);
  if (idx <= 0) return null;
  let provider = rest.slice(0, idx);
  const tool = rest.slice(idx + TOOL_SEP.length);
  if (!tool) return null;
  if (provider.startsWith(LEGACY_CUSTOM_PROVIDER_PREFIX)) {
    provider = CUSTOM_PROVIDER_PREFIX + provider.slice(LEGACY_CUSTOM_PROVIDER_PREFIX.length);
  }
  return { provider, tool };
}
