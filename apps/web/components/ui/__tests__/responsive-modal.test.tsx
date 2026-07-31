import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

/** Drive `useIsMobile`, which reads `window.matchMedia('(max-width: 767px)').matches`. */
function setViewport(mobile: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: mobile,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
}

const sheet = () => document.querySelector('[data-slot="sheet-content"]')
const dialog = () => document.querySelector('[data-slot="dialog-content"]')

describe('ResponsiveModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a centred dialog on desktop and a bottom sheet on mobile', () => {
    setViewport(false)
    const { unmount } = render(
      <ResponsiveModal open onOpenChange={() => {}} title="T">
        <p>body</p>
      </ResponsiveModal>,
    )
    expect(dialog()).toBeTruthy()
    expect(sheet()).toBeNull()
    unmount()

    setViewport(true)
    render(
      <ResponsiveModal open onOpenChange={() => {}} title="T">
        <p>body</p>
      </ResponsiveModal>,
    )
    expect(sheet()).toBeTruthy()
    expect(dialog()).toBeNull()
  })

  // Regression: `sm:` is live from 640px but the sheet renders below 768px, so a
  // desktop width cap passed via `className` used to squeeze the sheet on tablets.
  it('keeps desktopClassName off the mobile sheet', () => {
    setViewport(true)
    render(
      <ResponsiveModal open onOpenChange={() => {}} title="T" desktopClassName="sm:max-w-md">
        <p>body</p>
      </ResponsiveModal>,
    )
    expect(sheet()!.className).not.toContain('sm:max-w-md')
  })

  it('applies desktopClassName on desktop', () => {
    setViewport(false)
    render(
      <ResponsiveModal open onOpenChange={() => {}} title="T" desktopClassName="sm:max-w-md">
        <p>body</p>
      </ResponsiveModal>,
    )
    expect(dialog()!.className).toContain('sm:max-w-md')
  })

  // Regression: SheetContent ships no padding of its own, so the body used to run
  // edge-to-edge on mobile while header/footer carried their own p-6.
  it('pads the sheet body on mobile', () => {
    setViewport(true)
    render(
      <ResponsiveModal open onOpenChange={() => {}} title="T">
        <p>body</p>
      </ResponsiveModal>,
    )
    expect(sheet()!.className).toContain('p-6')
  })

  it('renders footer content in both branches', () => {
    for (const mobile of [false, true]) {
      setViewport(mobile)
      const { unmount } = render(
        <ResponsiveModal open onOpenChange={() => {}} title="T" footer={<button>go</button>}>
          <p>body</p>
        </ResponsiveModal>,
      )
      expect(screen.getByText('go')).toBeTruthy()
      unmount()
    }
  })

  it('honours showCloseButton={false} in both branches', () => {
    for (const mobile of [false, true]) {
      setViewport(mobile)
      const { unmount } = render(
        <ResponsiveModal open onOpenChange={() => {}} title="T" showCloseButton={false}>
          <p>body</p>
        </ResponsiveModal>,
      )
      expect(screen.queryByText('Close')).toBeNull()
      unmount()
    }
  })

  it('works with no children (title + footer only)', () => {
    setViewport(true)
    render(
      <ResponsiveModal open onOpenChange={() => {}} title="T" footer={<button>ok</button>} />,
    )
    expect(sheet()).toBeTruthy()
    expect(screen.getByText('ok')).toBeTruthy()
  })
})

describe('migrated call sites', () => {
  it('ConfirmDialog becomes a bottom sheet on mobile', () => {
    setViewport(true)
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      />,
    )
    expect(sheet()).toBeTruthy()
    expect(screen.getByText('Delete?')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('ConfirmDialog stays a dialog on desktop', () => {
    setViewport(false)
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      />,
    )
    expect(dialog()).toBeTruthy()
    expect(sheet()).toBeNull()
  })
})
