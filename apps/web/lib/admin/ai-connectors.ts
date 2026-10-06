/**
 * Workspace AI connector allow-list semantics (HANDOFF §5.4, auth-error-codes):
 *  - `connectorAllowList: []`   ⇒ members may connect EVERY connector;
 *  - `aiSettings.allowedConnectors: null` ⇒ the assistant inherits that list;
 *  - `aiSettings.allowedConnectors: []`   ⇒ the assistant uses NO connector;
 *  - `[...]` ⇒ only those (must be a subset of a non-empty workspace list).
 */

/** Catalog connectors the assistant's list may pick from. */
export function selectableAiConnectors<T extends { id: string }>(
  catalog: readonly T[],
  workspaceAllowList: readonly string[],
): T[] {
  if (workspaceAllowList.length === 0) return [...catalog]
  return catalog.filter((c) => workspaceAllowList.includes(c.id))
}

/** The value to save for `allowedConnectors`. */
export function allowedConnectorsToSave(
  restrict: boolean,
  selected: readonly string[],
  workspaceAllowList: readonly string[],
): string[] | null {
  if (!restrict) return null
  if (workspaceAllowList.length === 0) return [...selected]
  return selected.filter((id) => workspaceAllowList.includes(id))
}

export type AiConnectorScope = 'inherit-all' | 'inherit-list' | 'none' | 'some'

/** What the assistant may use, for the hint under the switch. */
export function aiConnectorScope(
  restrict: boolean,
  selected: readonly string[],
  workspaceAllowList: readonly string[],
): AiConnectorScope {
  if (!restrict) return workspaceAllowList.length === 0 ? 'inherit-all' : 'inherit-list'
  return selected.length === 0 ? 'none' : 'some'
}
