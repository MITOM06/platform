import { aiApi } from './axios'

// ── Types ────────────────────────────────────────────────────────────────────
// An AI session groups the messages the assistant "remembers" for one
// conversation. A conversation (chat-service) can have many sessions
// (ai-service); exactly one is active at a time. Mirrors the Flutter
// `AiSession` model (ai_session_panel.dart).
export interface AiSession {
  _id: string
  name: string
  isActive: boolean
  totalTokens: number
  summary: string | null
  createdAt: string
  updatedAt: string
}

// ── Service ──────────────────────────────────────────────────────────────────
// Targets ai-service (port 3002 / NEXT_PUBLIC_AI_URL) via the shared `aiApi`
// instance — same instance the admin usage dashboard uses.
export const aiSessionApi = {
  listSessions: (conversationId: string) =>
    aiApi
      .get<AiSession[]>(`/api/sessions/${conversationId}`)
      .then((r) => r.data),

  createNew: (conversationId: string) =>
    aiApi
      .post<AiSession>(`/api/sessions/${conversationId}/new`)
      .then((r) => r.data),

  resume: (conversationId: string, sessionId: string) =>
    aiApi
      .post<AiSession>(`/api/sessions/${conversationId}/resume/${sessionId}`)
      .then((r) => r.data),
}
