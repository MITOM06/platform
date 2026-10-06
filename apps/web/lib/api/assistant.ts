// lib/api/assistant.ts
import axios from 'axios'
import { chatApi } from './axios'

export interface AssistantInfo {
  botUserId: string
  name: string
  avatarUrl: string | null
  /** Current persona — prefills settings (null when Bot Factory can't be reached). */
  systemPrompt?: string | null
  /** Current model / provider — prefills settings (null when unknown). */
  providerId?: string | null
}

export interface AssistantProvider {
  id: string
  label: string
  provider: string
  model: string
}

/**
 * `POST /api/assistant/setup`. First setup needs `systemPrompt` + `providerId`
 * (400 ASSISTANT_SETUP_INCOMPLETE otherwise); on an existing assistant a blank or
 * absent value keeps the stored one, so a rename never wipes the persona.
 */
export interface AssistantSetupRequest {
  name: string
  systemPrompt?: string
  providerId?: string
}

const ASSISTANT_ERROR_KEYS: Record<string, string> = {
  ASSISTANT_SETUP_INCOMPLETE: 'errSetupIncomplete',
  ASSISTANT_NOT_CONFIGURED: 'errNotConfigured',
  ASSISTANT_UPSTREAM_FAILED: 'errUpstreamFailed',
}

/** `assistantSetup.*` key for a failed setup / update / delete. */
export function assistantErrorKey(err: unknown): string {
  if (!axios.isAxiosError(err)) return 'errGeneric'
  if (!err.response) return 'errNetwork'
  const code = (err.response.data as { code?: unknown } | undefined)?.code
  if (typeof code === 'string' && ASSISTANT_ERROR_KEYS[code]) return ASSISTANT_ERROR_KEYS[code]
  if (err.response.status === 503) return 'errNotConfigured'
  if (err.response.status === 502) return 'errUpstreamFailed'
  return 'errGeneric'
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
