import { afterEach, describe, expect, it, vi } from 'vitest'

// A self-host install often has no Firebase project. The module used to call
// getAuth() at import time, which throws auth/invalid-api-key without an API key
// — so every page importing it (profile → PhoneField) crashed.
describe('getFirebaseAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is null instead of throwing when Firebase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '')
    const mod = await import('@/lib/firebase')
    expect(mod.getFirebaseAuth()).toBeNull()
  })

  it('returns an Auth instance when an API key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaTestKey-not-real')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'pon-test')
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '1:1:web:1')
    const mod = await import('@/lib/firebase')
    expect(mod.getFirebaseAuth()).not.toBeNull()
  })
})
