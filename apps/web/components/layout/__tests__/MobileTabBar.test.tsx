import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/meetings/670f1c2ab9e4d21f0c3a9e11' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { MobileTabBar } from '@/components/layout/MobileTabBar'

describe('MobileTabBar', () => {
  it('has a Meetings tab that is active on meeting pages', () => {
    render(<MobileTabBar />)
    const link = screen.getByRole('link', { name: 'tabMeetings' })
    expect(link.getAttribute('href')).toBe('/meetings')
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})
