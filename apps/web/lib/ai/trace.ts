/**
 * Helpers for the Agent Trace view (`GET /api/messages/{id}/trace`).
 *
 * A trace tool call carries `inputSummary` (the start of the raw tool input — it
 * can be an email body) and `resultSummary` (the start of the raw tool output).
 * Neither is ever rendered; only a status derived from the result is.
 */

export type ToolCallStatus = 'done' | 'failed' | 'awaiting' | 'skipped'

/** Outcome of one traced tool call, from ai-service's fixed result markers. */
export function toolCallStatus(resultSummary: string | null | undefined): ToolCallStatus {
  const r = (resultSummary ?? '').trim()
  if (r === 'Awaiting user confirmation') return 'awaiting'
  if (r === 'Not available') return 'skipped'
  if (r === 'Not performed') return 'failed'
  if (/^(tool error|error)\b/i.test(r)) return 'failed'
  return 'done'
}

/**
 * Readable model name: `claude-sonnet-4-5-20250929` → `Claude Sonnet 4.5`.
 * Anything not shaped like a Claude id is shown as given (it is a product name,
 * not an internal identifier).
 */
export function modelDisplayName(model: string | null | undefined): string | null {
  const m = model?.trim()
  if (!m) return null
  const parts = m.replace(/-\d{8}$/, '').split('-')
  if (parts[0]?.toLowerCase() !== 'claude' || parts.length < 2) return m
  const words: string[] = []
  const version: string[] = []
  for (const part of parts) {
    if (/^\d+$/.test(part)) version.push(part)
    else words.push(part.charAt(0).toUpperCase() + part.slice(1))
  }
  return [...words, version.join('.')].filter(Boolean).join(' ')
}
