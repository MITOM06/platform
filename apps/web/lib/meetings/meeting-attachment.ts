import type { MeetingAttachment } from '@/lib/api/meeting-types'

/** Only our own upload store is a valid attachment target. */
export const UPLOAD_PREFIX = '/api/uploads/'

/**
 * `attachment` off the wire (meet.chat frame or history row) → typed, or undefined.
 * Valid: url string starting with `/api/uploads/`, non-empty name; size number (else 0);
 * contentType string (else null). Anything else drops the attachment, never the line.
 */
export function parseAttachment(v: unknown): MeetingAttachment | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  if (typeof o.url !== 'string' || !o.url.startsWith(UPLOAD_PREFIX)) return undefined
  if (typeof o.name !== 'string' || !o.name) return undefined
  return {
    url: o.url,
    name: o.name,
    size: typeof o.size === 'number' && Number.isFinite(o.size) ? o.size : 0,
    contentType: typeof o.contentType === 'string' ? o.contentType : null,
  }
}

/** A history row with its attachment validated (key removed when invalid). */
export function normalizeHistoryRow<T extends { attachment?: unknown }>(row: T): T {
  const { attachment, ...rest } = row
  const parsed = parseAttachment(attachment)
  return (parsed ? { ...rest, attachment: parsed } : rest) as T
}
