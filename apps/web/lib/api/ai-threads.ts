import { chatApi } from './axios'
import type { Conversation } from './types'

/** ChatGPT-style AI threads: each "new chat" with the AI is its own chat-service conversation. */
export const aiThreadsApi = {
  /** Caller's threads, newest activity first (max 100, hidden ones excluded). */
  list: () => chatApi.get<Conversation[]>('/api/ai-threads').then((r) => r.data),

  create: () => chatApi.post<Conversation>('/api/ai-threads').then((r) => r.data),

  /** 400 `AI_THREAD_NAME_INVALID` unless 1–80 chars after trim. */
  rename: (id: string, name: string) =>
    chatApi
      .patch<Conversation>(`/api/ai-threads/${encodeURIComponent(id)}`, { name })
      .then((r) => r.data),
}
