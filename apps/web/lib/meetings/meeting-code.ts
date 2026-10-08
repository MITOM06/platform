/**
 * Meeting codes look like `abc-defg-hjk`: 10 lowercase letters without i, l, o, grouped
 * 3-4-3. People paste codes in any case, with spaces or without dashes, or a whole link.
 */

export const MEETING_CODE_RE = /^[a-hjkmnp-z]{3}-[a-hjkmnp-z]{4}-[a-hjkmnp-z]{3}$/
const LETTERS_RE = /^[a-hjkmnp-z]{10}$/

/** Code or pasted link → canonical "abc-defg-hjk", or null. */
export function parseMeetingCodeInput(raw: string): string | null {
  let value = raw.trim()
  const at = value.indexOf('/meet/')
  if (at >= 0) {
    value = value.slice(at + '/meet/'.length).split(/[?#/]/)[0]
  } else if (value.includes('://')) {
    return null
  }
  const letters = value.toLowerCase().replace(/[\s-]+/g, '')
  if (!LETTERS_RE.test(letters)) return null
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`
}

export function meetingPath(code: string): string {
  return `/meet/${code}`
}

export function meetingLink(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${meetingPath(code)}`
}
