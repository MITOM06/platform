import { connectorApi } from './axios'
import type {
  ActionGroup,
  CatalogEntry,
  ConnectionPermissions,
  ConnectionView,
  CreateDirectoryEntryInput,
  CustomMcpDiscoverInput,
  CustomMcpDiscoverResponse,
  CustomMcpInput,
  DirectoryEntry,
  DirectoryStartResponse,
  OAuthStartResponse,
  UpdateDirectoryEntryInput,
  UserSkillState,
} from './connector-types'

/**
 * connector-service (:3003) client. The JWT is injected by the shared
 * `connectorApi` axios interceptor, and the backend derives the caller's
 * identity from the token (`req.user.sub`) — never from a client-supplied
 * `userId`. So no endpoint here passes a userId param.
 */
export const connectorService = {
  getCatalog: () =>
    connectorApi
      .get<CatalogEntry[]>('/catalog')
      // Coerce ANY non-array body to [] — when NEXT_PUBLIC_CONNECTOR_URL is
      // unset the request hits the web origin and returns HTML (a string),
      // which would otherwise crash `catalog.map(...)` in the admin UI.
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  getConnections: () =>
    connectorApi
      .get<ConnectionView[]>('/connections')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  startOAuth: (provider: string) =>
    connectorApi
      .get<OAuthStartResponse>(`/oauth/${provider}/start`)
      .then((r) => r.data),

  disconnect: (id: string) =>
    connectorApi.delete<void>(`/connections/${id}`).then((r) => r.data),

  getConnectionPermissions: (id: string) =>
    connectorApi
      .get<ConnectionPermissions>(`/connections/${id}/permissions`)
      .then((r) => r.data),

  updateConnectionPermissions: (id: string, actionGroups: ActionGroup[]) =>
    connectorApi
      .put<ConnectionPermissions>(`/connections/${id}/permissions`, {
        actionGroups,
      })
      .then((r) => r.data),

  discoverCustomMcp: (input: CustomMcpDiscoverInput) =>
    connectorApi
      .post<CustomMcpDiscoverResponse>('/custom-mcp/discover', input)
      .then((r) => r.data),

  saveCustomMcp: (input: CustomMcpInput) =>
    connectorApi.post<void>('/custom-mcp', input).then((r) => r.data),

  getSkills: () =>
    connectorApi
      .get<UserSkillState[]>('/skills')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  setSkill: (skillId: string, enabled: boolean) =>
    connectorApi
      .put<UserSkillState>('/skills', { skillId, enabled })
      .then((r) => r.data),

  // ── MCP Directory ─────────────────────────────────────────────────────────

  getDirectory: () =>
    connectorApi
      .get<DirectoryEntry[]>('/directory')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  startDirectoryOAuth: (slug: string) =>
    connectorApi
      .get<DirectoryStartResponse>(`/oauth/directory/${slug}/start`)
      .then((r) => r.data),

  connectDirectoryKey: (slug: string, credential: string) =>
    connectorApi
      .post<{ connected: true }>(`/oauth/directory/${slug}/connect-key`, {
        credential,
      })
      .then((r) => r.data),

  createDirectoryEntry: (input: CreateDirectoryEntryInput) =>
    connectorApi.post<DirectoryEntry>('/directory', input).then((r) => r.data),

  updateDirectoryEntry: (id: string, input: UpdateDirectoryEntryInput) =>
    connectorApi
      .patch<DirectoryEntry>(`/directory/${id}`, input)
      .then((r) => r.data),

  deleteDirectoryEntry: (id: string) =>
    connectorApi
      .delete<{ deleted: boolean }>(`/directory/${id}`)
      .then((r) => r.data),
}
