import { chatApi } from './axios'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TokenUsageDay {
  date: string
  inputTokens: number
  outputTokens: number
  requestCount: number
  totalTokens: number
}

export interface AiMemory {
  // P2b: memory is global per-user; the aggregate has no single conversationId.
  conversationId: string | null
  summary: string
  keyFacts: string[]
  messageCount: number
  updatedAt: string
}

export interface AiPersona {
  conversationId: string
  name: string
  avatarUrl?: string | null
  tone: string
  systemPromptPrefix?: string | null
}

// ── Service ────────────────────────────────────────────────────────────────────

export const aiService = {
  // Token usage
  getTokenUsage: (days = 30) =>
    chatApi
      .get<TokenUsageDay[]>('/api/usage/tokens', { params: { days } })
      .then((r) => r.data),

  // AI Memory — P2b: returns ONE aggregated per-user object (not an array).
  getMyMemories: () =>
    chatApi.get<AiMemory>('/api/ai/memories').then((r) => r.data),

  getConversationMemory: (conversationId: string) =>
    chatApi
      .get<AiMemory>(`/api/ai/memories/${conversationId}`)
      .then((r) => r.data),

  deleteMemory: (conversationId: string) =>
    chatApi.delete(`/api/ai/memories/${conversationId}`),

  // AI Persona (per-conversation)
  getPersona: (conversationId: string) =>
    chatApi
      .get<AiPersona>(`/api/conversations/${conversationId}/ai-persona`)
      .then((r) => r.data)
      .catch((e) => {
        if (e?.response?.status === 404) return null
        throw e
      }),

  upsertPersona: (
    conversationId: string,
    body: { name: string; avatarUrl?: string; tone: string; systemPromptPrefix?: string },
  ) =>
    chatApi
      .put<AiPersona>(`/api/conversations/${conversationId}/ai-persona`, body)
      .then((r) => r.data),

  deletePersona: (conversationId: string) =>
    chatApi.delete(`/api/conversations/${conversationId}/ai-persona`),
}
