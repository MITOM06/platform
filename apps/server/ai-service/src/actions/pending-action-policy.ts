import { ToolDefinition } from '../tools/tool.interface';
import { isConnectorTool, providerOf, toolOf } from '../tools/tool-names';

/**
 * Connector tools that run WITHOUT a confirmation although connector-service
 * flags them `sensitive` (it flags every non-read-only tool). Keep this list
 * tiny and explicit: anything not named here is confirmed.
 *
 *  - `create_draft`: a draft never leaves the member's mailbox — it is the safe
 *    path the mail-writing skill relies on.
 */
export const LOW_RISK_CONNECTOR_TOOLS: ReadonlySet<string> = new Set(['create_draft']);

/**
 * The bare tool name, lower-cased with `-` → `_`, and without the provider's
 * own prefix that hosted MCP servers add (`notion-create-pages` → `create_pages`).
 */
export function normalizedToolName(toolName: string): string {
  const provider = (providerOf(toolName) ?? '').toLowerCase();
  let bare = (toolOf(toolName) ?? toolName).toLowerCase().replace(/-/g, '_');
  if (provider && bare.startsWith(`${provider}_`) && bare.length > provider.length + 1) {
    bare = bare.slice(provider.length + 1);
  }
  return bare;
}

export function isLowRiskConnectorTool(toolName: string): boolean {
  return LOW_RISK_CONNECTOR_TOOLS.has(normalizedToolName(toolName));
}

/**
 * Whether a tool call must wait for the requester's in-chat confirmation.
 *
 * - Built-in tools (`create_reminder`, `remember_fact`, `search_*`,
 *   `summarize_conversation`, `get_user_info`, `web_search`) never do.
 * - Connector tools do when the offered definition is flagged `sensitive` and
 *   the name is not in {@link LOW_RISK_CONNECTOR_TOOLS}. Fail-closed: a
 *   definition without a boolean flag counts as sensitive.
 */
export function needsConfirmation(toolName: string, offered: ToolDefinition | undefined): boolean {
  if (!isConnectorTool(toolName)) return false;
  if (isLowRiskConnectorTool(toolName)) return false;
  return offered?.sensitive !== false;
}
