import { initializeApp, getApps } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

let cached: Auth | null | undefined

/**
 * Firebase Auth for phone verification, or null when this deployment has no
 * Firebase project (a self-host install usually does not). Created on first use:
 * getAuth() throws auth/invalid-api-key without an API key, and doing that at
 * import time crashed every page that imports this module.
 */
export function getFirebaseAuth(): Auth | null {
  if (cached !== undefined) return cached
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) {
    cached = null
    return cached
  }
  // Guard against hot-reload double-init
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
  cached = getAuth(app)
  return cached
}
