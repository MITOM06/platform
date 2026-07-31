'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Directional page motion for route changes — the web counterpart of the
 * Flutter client's `slidePage()` (`apps/client/lib/core/router/page_transitions.dart`).
 *
 * Going forward the new page fades in from the right; going back (browser back
 * button / `router.back()`) it comes from the left. Deliberately a short 14px
 * shift rather than mobile's full-width slide: on a desktop viewport a
 * full-screen slide reads as a gimmick, and a small offset keeps the motion on
 * the compositor.
 *
 * Implemented with the Web Animations API instead of a Next `template.tsx` on
 * purpose: a template remounts its children on every navigation — including
 * `/conversations/a → /conversations/b` — which would tear down and refetch the
 * whole thread. This animates the container the router already re-renders, so
 * nothing extra remounts and no animation library ships to the client.
 */

const DURATION_MS = 240
/** Matches `--pon-enter` / `AppMotion.settle` on mobile. */
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DISTANCE_PX = 14

/**
 * Last path we animated to. Module-level so it survives a layout swap: moving
 * between route groups (e.g. `/settings` → `/legal`) mounts a *different*
 * layout, and without this the fresh instance could not tell that navigation
 * apart from a cold page load — which must never animate.
 */
let lastPath: string | null = null

/**
 * Set on `popstate`, the only signal the browser gives us for "backwards":
 * `<Link>` and `router.push()` go through `pushState` and never fire it.
 * Module-level for the same reason as [lastPath] — the event can land while the
 * outgoing layout is still the mounted one.
 */
let goingBack = false

// Registered once at module scope rather than from an effect: a cross-group
// navigation (say `/legal` → `/settings`) swaps one layout's PageTransition for
// another's, and the event must not fall through whichever gap that leaves.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    goingBack = true
  })
}

export function PageTransition({
  as = 'div',
  className,
  children,
}: {
  as?: 'main' | 'div'
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement | null>(null)
  const animation = useRef<Animation | null>(null)
  const pathname = usePathname()

  // A callback ref, so the same hook can back either tag without casting.
  const setRef = useCallback((node: HTMLElement | null) => {
    ref.current = node
  }, [])

  useEffect(() => {
    // First paint of the session is a page load, not a navigation. The equality
    // check also covers a layout remounting on the same path (and React's
    // double-invoked effects in dev).
    if (lastPath === null || lastPath === pathname) {
      lastPath = pathname
      return
    }
    lastPath = pathname

    const back = goingBack
    goingBack = false

    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    animation.current?.cancel()
    animation.current = el.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(${back ? -DISTANCE_PX : DISTANCE_PX}px, 0, 0)`,
        },
        { opacity: 1, transform: 'none' },
      ],
      { duration: DURATION_MS, easing: EASING },
    )
  }, [pathname])

  return as === 'main' ? (
    <main ref={setRef} className={className}>
      {children}
    </main>
  ) : (
    <div ref={setRef} className={className}>
      {children}
    </div>
  )
}
