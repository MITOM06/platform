'use client'

import { useHasCapability } from '@/lib/hooks/use-capabilities'
import type { Capability } from '@/lib/api/admin-types'

interface RequireCapProps {
  cap: Capability
  children: React.ReactNode
  /** Rendered instead of children when the capability is absent. */
  fallback?: React.ReactNode
}

/**
 * Renders [children] only when the caller holds [cap]; otherwise [fallback]
 * (default: nothing). UI-only gating — the backend independently enforces every
 * mutation via @RequirePermission.
 */
export function RequireCap({ cap, children, fallback = null }: RequireCapProps) {
  const allowed = useHasCapability(cap)
  return <>{allowed ? children : fallback}</>
}
