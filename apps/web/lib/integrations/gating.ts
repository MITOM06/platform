import type { Capability } from '@/lib/api/admin-types'
import type { ConnectionView, DirectoryTier } from '@/lib/api/connector-types'

/**
 * UI mirror of connector-service governance (HANDOFF §5.4). The server enforces
 * every rule; these only keep the UI from offering an action it would refuse.
 */

/** Capability needed to connect a connector of [tier] (`both` connects personally). */
export function connectCapability(tier: DirectoryTier | undefined): Capability {
  return tier === 'workspace' ? 'CONNECT_WORKSPACE_CONNECTOR' : 'CONNECT_PERSONAL_CONNECTOR'
}

export function canConnect(
  tier: DirectoryTier | undefined,
  perms: readonly Capability[] | undefined,
): boolean {
  return !!perms?.includes(connectCapability(tier))
}

/**
 * Personal connections listed to me are mine (the server only returns my own);
 * a workspace connection is shared and needs CONNECT_WORKSPACE_CONNECTOR.
 */
export function canDisconnect(
  connection: Pick<ConnectionView, 'scope'>,
  perms: readonly Capability[] | undefined,
): boolean {
  if (connection.scope !== 'workspace') return true
  return !!perms?.includes('CONNECT_WORKSPACE_CONNECTOR')
}

/** A connection worth showing as "connected" (active) or "reconnect needed" (expired). */
export function connectionState(
  connection: Pick<ConnectionView, 'status'> | undefined,
): 'connected' | 'expired' | 'none' {
  if (!connection) return 'none'
  if (connection.status === 'active') return 'connected'
  if (connection.status === 'expired') return 'expired'
  return 'none'
}
