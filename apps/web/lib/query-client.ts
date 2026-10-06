import type { QueryClient } from '@tanstack/react-query'

/**
 * The app's single TanStack QueryClient, registered by `components/providers.tsx`
 * so non-React code (logout, forced logout) can wipe the cache. Without this a
 * sign-out left the previous user's conversations, AI context and usage in memory
 * for whoever signed in next in the same tab.
 */
let current: QueryClient | null = null

export function registerQueryClient(queryClient: QueryClient): void {
  current = queryClient
}

/** Drop every cached query (and cancel in-flight ones). No-op before registration. */
export function clearQueryCache(): void {
  current?.clear()
}
