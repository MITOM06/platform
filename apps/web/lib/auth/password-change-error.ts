import axios from 'axios'

/**
 * `POST /api/users/me/change-password` failure → message key shared by the
 * security page and the change-password dialog (both namespaces define
 * `incorrectCurrent`, `currentRequired`, `tooShort`, `networkError`, `genericError`).
 *
 * Read by `code` (auth-service contract 2026-10-05): CURRENT_PASSWORD_REQUIRED,
 * CURRENT_PASSWORD_INCORRECT, VAL_PASSWORD_TOO_SHORT (`params.min`). The English
 * `message` is only consulted for servers that predate the codes, and is never shown.
 */
export function passwordChangeErrorKey(err: unknown): {
  key: string
  values?: Record<string, number>
} {
  if (!axios.isAxiosError(err)) return { key: 'genericError' }
  if (!err.response) return { key: 'networkError' }
  const data = err.response.data as
    | { code?: unknown; params?: { min?: unknown }; message?: unknown }
    | undefined
  const code = typeof data?.code === 'string' ? data.code : undefined
  const legacy = typeof data?.message === 'string' ? data.message : ''
  if (code === 'CURRENT_PASSWORD_INCORRECT' || legacy.includes('Incorrect current password')) {
    return { key: 'incorrectCurrent' }
  }
  if (code === 'CURRENT_PASSWORD_REQUIRED' || legacy.includes('Current password is required')) {
    return { key: 'currentRequired' }
  }
  if (code === 'VAL_PASSWORD_TOO_SHORT' || /at least \d+ characters/.test(legacy)) {
    const min = Number(data?.params?.min)
    return { key: 'tooShort', values: { min: Number.isFinite(min) && min > 0 ? min : 8 } }
  }
  return { key: 'genericError' }
}
