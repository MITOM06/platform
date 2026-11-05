// Media URL + file helpers — mirror Flutter `image_content.dart` / `file_content.dart`.
import { serviceUrl, isRelative } from '@/lib/config/env'
import { getMediaToken } from '@/lib/media-token'

// When CHAT_URL is the same-origin relative path there is no prefix to add: the
// upload path is already absolute against the current origin.

/** Add `t=<media token>` to an upload URL (before any `#fragment`). Other URLs untouched. */
function withMediaToken(url: string): string {
  const token = getMediaToken()
  if (!token) return url
  const hashAt = url.indexOf('#')
  const head = hashAt === -1 ? url : url.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : url.slice(hashAt)
  const path = head.split('?')[0]
  const base = isRelative(serviceUrl('chat')) ? '' : serviceUrl('chat')
  const rel = base && path.startsWith(base) ? path.slice(base.length) : path
  if (!rel.startsWith('/api/uploads/')) return url
  const sep = head.includes('?') ? '&' : '?'
  return `${head}${sep}t=${encodeURIComponent(token)}${fragment}`
}

/** Resolve a possibly-relative media URL against the chat-service base (+ media token for uploads). */
export function absoluteMediaUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.startsWith('http')) return withMediaToken(url)
  const chat = serviceUrl('chat')
  const base = isRelative(chat) ? '' : chat
  const sep = url.startsWith('/') ? '' : '/'
  return withMediaToken(`${base}${sep}${url}`)
}

/** Build a download URL (adds `download=true` so the server serves as attachment). */
export function downloadMediaUrl(url: string): string {
  const abs = absoluteMediaUrl(url)
  const hashAt = abs.indexOf('#')
  const head = hashAt === -1 ? abs : abs.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : abs.slice(hashAt)
  const sep = head.includes('?') ? '&' : '?'
  return `${head}${sep}download=true${fragment}`
}

/** Parse image-message content that may be a single URL or a JSON array of URLs. */
export function parseImageUrls(content: string): string[] {
  try {
    const decoded = JSON.parse(content)
    if (Array.isArray(decoded)) {
      return decoded.filter((u): u is string => typeof u === 'string')
    }
  } catch {
    // not JSON — treat as single URL
  }
  return [content]
}

export interface FileMeta {
  url: string
  name: string
  size: number
}

/**
 * Coerce a file `size` field to a number. Backends have historically stored it
 * as a numeric string (`"12345"`, `String.valueOf`), so accept both a number
 * and a numeric string; anything else → 0. Mirrors the cross-platform contract.
 */
function parseFileSize(size: unknown): number {
  if (typeof size === 'number' && Number.isFinite(size)) return size
  if (typeof size === 'string' && size.trim() !== '' && !Number.isNaN(Number(size))) {
    return Number(size)
  }
  return 0
}

/** Decode a `file` message content (`{url,name,size}` JSON, fallback to raw URL). */
export function parseFileMeta(content: string): FileMeta {
  try {
    const decoded = JSON.parse(content)
    if (decoded && typeof decoded === 'object' && 'url' in decoded) {
      return {
        url: String(decoded.url),
        name: typeof decoded.name === 'string' ? decoded.name : 'file',
        size: parseFileSize(decoded.size),
      }
    }
  } catch {
    // not JSON
  }
  return { url: content, name: 'file', size: 0 }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`
}

/** First http(s) URL found in a text string, or null. */
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/i
export function firstUrl(text: string): string | null {
  const match = text.match(URL_REGEX)
  if (!match) return null
  // Strip trailing sentence punctuation that is almost never part of the URL
  // ("see https://x.com." → "https://x.com") so link unfurling gets a clean URL.
  return match[0].replace(/[.,;:!?]+$/, '')
}
