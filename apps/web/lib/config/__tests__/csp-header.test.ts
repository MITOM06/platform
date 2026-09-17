import { describe, it, expect, beforeEach, vi } from 'vitest'

type HeaderEntry = { key: string; value: string }
type HeaderRule = { source: string; headers: HeaderEntry[] }
type ConfigWithHeaders = { headers: () => Promise<HeaderRule[]> }

/** The Content-Security-Policy the app actually serves for a given backend. */
async function cspFor(apiBase: string): Promise<string> {
  vi.resetModules()
  process.env.NEXT_PUBLIC_API_BASE = apiBase
  const mod = await import('../../../next.config')
  const config = mod.default as unknown as ConfigWithHeaders
  const rules = await config.headers()
  const entry = rules[0].headers.find((h) => h.key === 'Content-Security-Policy')
  if (!entry) throw new Error('no Content-Security-Policy header emitted')
  return entry.value
}

const directive = (csp: string, name: string): string =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('emitted Content-Security-Policy', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE
  })

  // Serving every backend from one host under /api/<service> turned each source
  // into a path-bearing expression, which CSP matches against the whole path.
  // The browser then blocked every API call the app makes — login and register
  // included — with "violates ... connect-src".
  it('allows the whole API origin rather than a single path', async () => {
    const csp = await cspFor('https://api.example.com')

    for (const name of ['connect-src', 'media-src', 'img-src']) {
      const d = directive(csp, name)
      expect(d, `${name} must allow the API origin`).toContain('https://api.example.com')
      expect(d, `${name} must not pin a path`).not.toMatch(
        /https:\/\/api\.example\.com\/\S/,
      )
    }
  })

  it('still names a per-service host when the backend is not path-based', async () => {
    const csp = await cspFor('https://backend.example.com')
    expect(directive(csp, 'connect-src')).toContain('https://backend.example.com')
  })
})
