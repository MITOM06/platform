/**
 * Connector (MCP) tool names are namespaced `mcp__<provider>__<tool>` by
 * connector-service (HANDOFF §5.4). Pure helpers shared by the registry, the
 * loop's confirmation gate and the pending-action summaries.
 */
export const MCP_PREFIX = 'mcp__';
const MCP_SEP = '__';

/** Whether the name is a connector tool (vs a built-in). */
export function isConnectorTool(name: string): boolean {
  return name.startsWith(MCP_PREFIX);
}

/** Extract the `<provider>` segment from `mcp__<provider>__<tool>`; else null. */
export function providerOf(name: string): string | null {
  if (!name.startsWith(MCP_PREFIX)) return null;
  const rest = name.slice(MCP_PREFIX.length);
  const idx = rest.indexOf(MCP_SEP);
  return idx > 0 ? rest.slice(0, idx) : null;
}

/** Extract the bare `<tool>` segment from `mcp__<provider>__<tool>`; else null. */
export function toolOf(name: string): string | null {
  const provider = providerOf(name);
  return provider === null ? null : name.slice(MCP_PREFIX.length + provider.length + MCP_SEP.length);
}
