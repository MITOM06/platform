/**
 * Where to go back to after signing in. Only meeting links are remembered: the
 * middleware stores `/meet/{code}` or `/meetings[/{id}]` in a short-lived cookie
 * when it bounces a signed-out visitor to /login, and establishSession consumes
 * it. The strict allow-list rules out open redirects (no scheme, `//`, `\`, `..`).
 *
 * Edge-safe: no browser globals at module top level (middleware imports this).
 */

export const RETURN_PATH_COOKIE = 'pon_return_to'
export const RETURN_PATH_MAX_AGE = 600 // seconds

const MEET_RE = /^\/meet\/[a-z-]{10,14}$/
const MEETINGS_RE = /^\/meetings(\/[A-Za-z0-9]{1,64})?$/

/** Only the two meeting entry points, same origin, no traversal. */
export function isSafeReturnPath(path: string): boolean {
  if (!path || path.includes('//') || path.includes('\\') || path.includes('..')) return false
  return MEET_RE.test(path) || MEETINGS_RE.test(path)
}

/** Read + delete the cookie in the browser; null when absent/unsafe/SSR. */
export function consumeReturnPath(doc?: Pick<Document, 'cookie'>): string | null {
  const target = doc ?? (typeof document === 'undefined' ? undefined : document)
  if (!target) return null
  const prefix = `${RETURN_PATH_COOKIE}=`
  const entry = target.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix))
  if (entry === undefined) return null
  target.cookie = `${RETURN_PATH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
  let value: string
  try {
    value = decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return null
  }
  return isSafeReturnPath(value) ? value : null
}
