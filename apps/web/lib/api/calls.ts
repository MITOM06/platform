import { chatApi } from './axios'
import type { CallConfig, CallToken } from './types'

/** chat-service calls on LiveKit — see docs/api-spec.md "Calls on LiveKit". */
export const callsApi = {
  getConfig: (): Promise<CallConfig> =>
    chatApi.get<CallConfig>('/api/calls/config').then((r) => r.data),
  getToken: (callId: string): Promise<CallToken> =>
    chatApi.post<CallToken>(`/api/calls/${encodeURIComponent(callId)}/token`).then((r) => r.data),
}
