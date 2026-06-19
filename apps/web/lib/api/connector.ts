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
 * `connectorApi` axios interceptor; `userId` is still passed as a query param
 * because the backend keys connections/skills by it (matches the REST contract).
 */
export const connectorService = {
  getCatalog: () =>
    connectorApi.get<CatalogEntry[]>('/catalog').then((r) => r.data ?? []),

  getConnections: (userId: string) =>
    connectorApi
      .get<ConnectionView[]>('/connections', { params: { userId } })
      .then((r) => r.data ?? []),

  startOAuth: (provider: string, userId: string) =>
    connectorApi
      .get<OAuthStartResponse>(`/oauth/${provider}/start`, { params: { userId } })
      .then((r) => r.data),

  disconnect: (id: string) =>
    connectorApi.delete<void>(`/connections/${id}`).then((r) => r.data),

  discoverCustomMcp: (input: CustomMcpDiscoverInput) =>
    connectorApi
      .post<CustomMcpDiscoverResponse>('/custom-mcp/discover', input)
      .then((r) => r.data),

  saveCustomMcp: (input: CustomMcpInput) =>
    connectorApi.post<void>('/custom-mcp', input).then((r) => r.data),

  getSkills: (userId: string) =>
    connectorApi
      .get<UserSkillState[]>('/skills', { params: { userId } })
      .then((r) => r.data ?? []),

  setSkill: (userId: string, skillId: string, enabled: boolean) =>
    connectorApi
      .put<UserSkillState>('/skills', { userId, skillId, enabled })
      .then((r) => r.data),
}
