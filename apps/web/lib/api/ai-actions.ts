import { aiApi } from './axios'

/** `POST /ai/actions/:id/{confirm,cancel}` response (CONTRACTS-ROUND2 §F2). */
export interface PendingActionResolution {
  status: 'confirmed' | 'failed' | 'cancelled'
}

/**
 * Sensitive AI actions held for in-chat confirmation. Routes live on ai-service
 * (`aiApi`; through the mini's Caddy that is `/api/ai/ai/actions/...`). Neither
 * call sends a body: confirm runs the input stored when the AI prepared the action.
 * Errors: 404 ACTION_NOT_FOUND, 403 ACTION_NOT_OWNER, 409 ACTION_ALREADY_RESOLVED,
 * 410 ACTION_EXPIRED.
 */
export const aiActionsService = {
  confirm: (id: string) =>
    aiApi
      .post<PendingActionResolution>(`/ai/actions/${encodeURIComponent(id)}/confirm`)
      .then((r) => r.data),

  cancel: (id: string) =>
    aiApi
      .post<PendingActionResolution>(`/ai/actions/${encodeURIComponent(id)}/cancel`)
      .then((r) => r.data),
}
