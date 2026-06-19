/**
 * Tests for lib/media.ts URL/file helpers.
 *
 * Mirrors the Flutter `media_url` test (lib/core/utils/media_url.dart) so the
 * relative→absolute resolution rules stay in sync across platforms.
 *
 * NEXT_PUBLIC_CHAT_URL is read at call time from process.env, so we pin it here.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  absoluteMediaUrl,
  downloadMediaUrl,
  parseImageUrls,
  parseFileMeta,
  formatBytes,
  firstUrl,
} from '@/lib/media'

const BASE = 'http://localhost:8080'

beforeEach(() => {
  process.env.NEXT_PUBLIC_CHAT_URL = BASE
})

describe('absoluteMediaUrl', () => {
  it('returns empty string for empty input', () => {
    expect(absoluteMediaUrl('')).toBe('')
  })

  it('passes through absolute http(s) URLs unchanged', () => {
    expect(absoluteMediaUrl('http://cdn.example.com/a.jpg')).toBe('http://cdn.example.com/a.jpg')
    expect(absoluteMediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('passes through blob: and data: URLs unchanged', () => {
    expect(absoluteMediaUrl('blob:abc-123')).toBe('blob:abc-123')
    expect(absoluteMediaUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('prefixes a leading-slash relative path with the chat base (no double slash)', () => {
    expect(absoluteMediaUrl('/api/uploads/img.jpg')).toBe(`${BASE}/api/uploads/img.jpg`)
  })

  it('inserts a separating slash for a path without a leading slash', () => {
    expect(absoluteMediaUrl('api/uploads/img.jpg')).toBe(`${BASE}/api/uploads/img.jpg`)
  })

  it('strips a trailing slash on the base before joining', () => {
    process.env.NEXT_PUBLIC_CHAT_URL = `${BASE}/`
    expect(absoluteMediaUrl('/x.png')).toBe(`${BASE}/x.png`)
  })
})

describe('downloadMediaUrl', () => {
  it('appends download=true with ? when no query exists', () => {
    expect(downloadMediaUrl('/api/uploads/doc.pdf')).toBe(`${BASE}/api/uploads/doc.pdf?download=true`)
  })

  it('appends download=true with & when a query already exists', () => {
    expect(downloadMediaUrl('https://cdn.example.com/a.pdf?v=2')).toBe(
      'https://cdn.example.com/a.pdf?v=2&download=true',
    )
  })
})

describe('parseImageUrls', () => {
  it('parses a JSON array of URLs', () => {
    expect(parseImageUrls('["/a.jpg","/b.jpg"]')).toEqual(['/a.jpg', '/b.jpg'])
  })

  it('treats a plain string as a single URL', () => {
    expect(parseImageUrls('/a.jpg')).toEqual(['/a.jpg'])
  })

  it('filters non-string entries out of the array', () => {
    expect(parseImageUrls('["/a.jpg",123,null]')).toEqual(['/a.jpg'])
  })
})

describe('parseFileMeta', () => {
  it('decodes {url,name,size} JSON', () => {
    expect(parseFileMeta('{"url":"/f.pdf","name":"report.pdf","size":2048}')).toEqual({
      url: '/f.pdf',
      name: 'report.pdf',
      size: 2048,
    })
  })

  it('falls back to a raw URL when content is not JSON', () => {
    expect(parseFileMeta('/raw.pdf')).toEqual({ url: '/raw.pdf', name: 'file', size: 0 })
  })
})

describe('formatBytes', () => {
  it('returns empty for zero/negative', () => {
    expect(formatBytes(0)).toBe('')
  })

  it('formats bytes, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0 MB')
  })
})

describe('firstUrl', () => {
  it('extracts the first http(s) URL from text', () => {
    expect(firstUrl('see https://example.com/x now')).toBe('https://example.com/x')
  })

  it('returns null when no URL is present', () => {
    expect(firstUrl('no links here')).toBeNull()
  })
})
