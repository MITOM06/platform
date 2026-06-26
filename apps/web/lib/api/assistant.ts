// lib/api/assistant.ts
import { chatApi } from './axios'

export interface AssistantInfo {
  botUserId: string
  name: string
  avatarUrl: string | null
}

export interface AssistantProvider {
  id: string
  label: string
  provider: string
  model: string
}

export interface AssistantSetupRequest {
  name: string
  systemPrompt: string
  providerId: string
}

export interface AssistantSetupResponse {
  botUserId: string
  name: string
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

/** Idempotent create-or-update of the member's personal assistant. */
export async function setupAssistant(
  req: AssistantSetupRequest,
): Promise<AssistantSetupResponse> {
  const res = await chatApi.post<AssistantSetupResponse>('/api/assistant/setup', req)
  return res.data
}

export async function deleteAssistant(): Promise<void> {
  await chatApi.delete('/api/assistant/setup')
}

/** Available Bot Factory provider/model options. Coerces non-array to []. */
export async function fetchAssistantProviders(): Promise<AssistantProvider[]> {
  const res = await chatApi.get<AssistantProvider[]>('/api/assistant/providers')
  return Array.isArray(res.data) ? res.data : []
}
