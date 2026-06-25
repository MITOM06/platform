// lib/api/assistant.ts
import { chatApi } from './axios'

export interface AssistantInfo {
  botUserId: string
  name: string
  avatarUrl: string | null
}

/** Returns null when no assistant is registered for the current member (404). */
export async function fetchAssistant(): Promise<AssistantInfo | null> {
  try {
    const res = await chatApi.get<AssistantInfo>('/api/assistant/me')
    return res.data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw err
  }
}
