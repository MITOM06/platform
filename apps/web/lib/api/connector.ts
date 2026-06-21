import { connectorApi } from './axios'
import type {
  CatalogEntry,
  ConnectionView,
  CustomMcpDiscoverInput,
  CustomMcpDiscoverResponse,
  CustomMcpInput,
  OAuthStartResponse,
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
}
