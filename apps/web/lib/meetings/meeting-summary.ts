/**
 * Pure normalizer for the `content` of a `meeting_summary` chat message and for the
 * `summary` object of `GET /api/meetings/{id}/summary`. Reads both shapes:
 *  - old (group call): `actionItems: string[]`, no decisions / fromMaterials / title
 *  - new (meeting):    `actionItems: {text, assigneeName|null}[]`, decisions, fromMaterials, title
 * Mirrors Flutter `domain/meeting_summary.dart` (`normalizeSummary`) — keep identical.
 *
 * Rules: non-object ⇒ null. Missing / wrongly typed fields get empty defaults; list
 * elements of the wrong type (or blank strings) are dropped; blank assignee / title ⇒ null;
 * `durationSec` must be a finite number ≥ 0, else 0.
 */

export interface SummaryActionItem {
  text: string
  assigneeName: string | null
}

export interface NormalizedSummary {
  overview: string
  keyPoints: string[]
  decisions: string[]
  actionItems: SummaryActionItem[]
  fromMaterials: string[]
  attendees: string[]
  durationSec: number
  title: string | null
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Trimmed non-empty string, else null. */
const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(text).filter((s): s is string => s !== null)
}

function actions(v: unknown): SummaryActionItem[] {
  if (!Array.isArray(v)) return []
  const out: SummaryActionItem[] = []
  for (const item of v) {
    if (typeof item === 'string') {
      const t = text(item)
      if (t) out.push({ text: t, assigneeName: null })
    } else if (isObj(item)) {
      const t = text(item.text)
      if (t) out.push({ text: t, assigneeName: text(item.assigneeName) })
    }
  }
  return out
}

export function normalizeSummary(raw: unknown): NormalizedSummary | null {
  if (!isObj(raw)) return null
  const d = raw.durationSec
  return {
    overview: typeof raw.overview === 'string' ? raw.overview : '',
    keyPoints: strings(raw.keyPoints),
    decisions: strings(raw.decisions),
    actionItems: actions(raw.actionItems),
    fromMaterials: strings(raw.fromMaterials),
    attendees: strings(raw.attendees),
    durationSec: typeof d === 'number' && Number.isFinite(d) && d >= 0 ? d : 0,
    title: text(raw.title),
  }
}
