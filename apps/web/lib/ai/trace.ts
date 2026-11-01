/**
 * Helpers for the Agent Trace view (`GET /api/messages/{id}/trace`).
 *
 * A trace tool call carries `inputSummary` (the start of the raw tool input — it
 * can be an email body) and `resultSummary` (the start of the raw tool output).
 * Neither is ever rendered; only a status derived from the result is.
 */

export type ToolCallStatus = 'done' | 'failed' | 'awaiting' | 'skipped' | 'cancelled' | 'expired'

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
 * The trace is written when the reply ends, so a held call stays "awaiting" in it
 * forever. The confirmation card on the same message carries the real outcome:
 * each awaiting call takes the status of the next card with the same tool name
 * (in order). Pending or unmatched calls stay awaiting.
 */
export function resolvedToolCallStatuses(
  toolCalls: ReadonlyArray<{ toolName: string; resultSummary?: string | null }>,
  actions: ReadonlyArray<{ toolName?: string; status?: string }> | null | undefined,
): ToolCallStatus[] {
  const used = new Set<number>()
  return toolCalls.map((tc) => {
    const base = toolCallStatus(tc.resultSummary)
    if (base !== 'awaiting' || !actions) return base
    const idx = actions.findIndex((a, i) => !used.has(i) && a.toolName === tc.toolName)
    if (idx < 0) return base
    used.add(idx)
    switch (actions[idx].status) {
      case 'confirmed':
        return 'done'
      case 'cancelled':
        return 'cancelled'
      case 'expired':
        return 'expired'
      case 'failed':
        return 'failed'
      default:
        return base
    }
  })
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
