import { describe, it, expect, vi } from 'vitest'

type HeaderEntry = { key: string; value: string }
type HeaderRule = { source: string; headers: HeaderEntry[] }
type ConfigWithHeaders = { headers: () => Promise<HeaderRule[]> }

async function permissionsPolicy(): Promise<string> {
  vi.resetModules()
  const mod = await import('../../../next.config')
  const config = mod.default as unknown as ConfigWithHeaders
  const rules = await config.headers()
  const entry = rules[0].headers.find((h) => h.key === 'Permissions-Policy')
  if (!entry) throw new Error('no Permissions-Policy header emitted')
  return entry.value
}

const feature = (policy: string, name: string): string =>
  policy
    .split(',')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name}=`)) ?? ''

describe('emitted Permissions-Policy', () => {
  // `camera=()` / `microphone=()` disables the feature for the page itself, so
  // getUserMedia rejects with NotAllowedError before the browser even asks —
  // every voice/video call and voice message on web failed that way.
  it.each(['camera', 'microphone'])('lets the app itself use the %s', async (name) => {
    expect(feature(await permissionsPolicy(), name)).toBe(`${name}=(self)`)
  })

  it('keeps geolocation disabled', async () => {
    expect(feature(await permissionsPolicy(), 'geolocation')).toBe('geolocation=()')
  })
})
