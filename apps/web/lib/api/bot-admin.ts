import { chatApi, connectorApi } from './axios'

/** One active integration session for a bot, as returned by connector-service. */
export interface BotSessionSummary {
  botUserId: string
  createdAt: string
  lastUsedAt: string | null
}

/** One-time issued integration token + its MCP URL. Never persist client-side. */
export interface IssuedToken {
  token: string
  mcpUrl: string
}

/** A registered Bot Factory bot, as returned by chat-service admin list. */
export interface ExternalBot {
  id: string
  botUserId: string
  factoryBotId: string
  ownerUserId: string
  name: string
  avatarUrl: string
  enabled: boolean
}

interface SessionsResponse {
  sessions?: BotSessionSummary[]
}

/**
 * Bot Factory admin integration API.
 *
 * Token ops hit connector-service (:3003) via `connectorApi`; the bot list is
 * read from chat-service (:8080) via `chatApi`. Both are gated by
 * MANAGE_WORKSPACE on the backend. The `Array.isArray` coercion mirrors
 * `lib/api/connector.ts` — when an env URL is unset the request hits the web
 * origin and returns HTML, which would otherwise crash `.map(...)`.
 */
export const botAdminService = {
  issue: (userId: string, botUserId: string): Promise<IssuedToken> =>
    connectorApi
      .post<IssuedToken>('/api/bot/sessions', { userId, botUserId })
      .then((r) => r.data),

  revoke: (userId: string, botUserId: string): Promise<void> =>
    connectorApi
      .delete<void>('/api/bot/sessions', { data: { userId, botUserId } })
      .then(() => undefined),

  listSessions: (userId: string): Promise<BotSessionSummary[]> =>
    connectorApi
      .get<SessionsResponse>('/api/bot/sessions', { params: { userId } })
      .then((r) => (Array.isArray(r.data?.sessions) ? r.data.sessions : [])),

  listExternalBots: (): Promise<ExternalBot[]> =>
    chatApi
      .get<ExternalBot[]>('/api/admin/external-bots')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),
}
