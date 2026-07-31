import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { PageTransition } from '@/components/layout/PageTransition'

let pathname = '/conversations'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

/** jsdom ships no Web Animations API — record the calls instead. */
const animate = vi.fn(() => ({ cancel: vi.fn() }))

/** The x offset of the first keyframe, i.e. where the page slides in FROM. */
function enterFromX(): number {
  const [keyframes] = animate.mock.calls.at(-1) as unknown as [
    Array<{ transform: string }>,
  ]
  return Number(/translate3d\((-?\d+)px/.exec(keyframes[0].transform)![1])
}

function renderAt(path: string) {
  pathname = path
  return render(<PageTransition>page</PageTransition>)
}

describe('PageTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.animate = animate as unknown as Element['animate']
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    // The module tracks the last path across mounts; walking through a known
    // first navigation puts every test on the same footing.
    renderAt('/reset-a').unmount()
    renderAt('/reset-b').unmount()
    vi.clearAllMocks()
  })

  it('does not animate when the path has not changed', () => {
    renderAt('/reset-b')
    expect(animate).not.toHaveBeenCalled()
  })

  it('slides in from the right when navigating forward', () => {
    renderAt('/settings')
    expect(animate).toHaveBeenCalledTimes(1)
    expect(enterFromX()).toBeGreaterThan(0)
  })

  it('slides in from the left after the browser back button', () => {
    window.dispatchEvent(new PopStateEvent('popstate'))
    renderAt('/friends')
    expect(enterFromX()).toBeLessThan(0)
  })

  it('goes back to forward motion on the navigation after a back step', () => {
    window.dispatchEvent(new PopStateEvent('popstate'))
    renderAt('/friends').unmount()
    renderAt('/help')
    expect(enterFromX()).toBeGreaterThan(0)
  })

  it('skips the animation when the user asked for reduced motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    renderAt('/skills')
    expect(animate).not.toHaveBeenCalled()
  })
})
