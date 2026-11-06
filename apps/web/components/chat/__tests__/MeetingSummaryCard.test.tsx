import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { MeetingSummaryCard } from '@/components/chat/MeetingSummaryCard'

const j = (o: unknown) => JSON.stringify(o)

describe('MeetingSummaryCard', () => {
  it('renders the old format without decisions / materials sections', () => {
    render(<MeetingSummaryCard content={j({
      attendees: ['An'], durationSec: 65, overview: 'Hello', keyPoints: ['kp'], actionItems: ['do x'],
    })} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('do x')).toBeInTheDocument()
    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.queryByText('summaryDecisions')).not.toBeInTheDocument()
    expect(screen.queryByText('summaryFromMaterials')).not.toBeInTheDocument()
  })

  it('renders the new format: decisions, materials, assignee suffix, title', () => {
    render(<MeetingSummaryCard content={j({
      meetingId: 'm1', title: 'Weekly', attendees: ['An'], durationSec: 5, overview: 'o',
      keyPoints: [], decisions: ['Go live'], fromMaterials: ['deck.pdf'], language: 'en',
      actionItems: [{ text: 'Ship', assigneeName: 'Binh' }, { text: 'Test', assigneeName: null }],
    })} />)
    expect(screen.getByText('summaryDecisions')).toBeInTheDocument()
    expect(screen.getByText('Go live')).toBeInTheDocument()
    expect(screen.getByText('summaryFromMaterials')).toBeInTheDocument()
    expect(screen.getByText('deck.pdf')).toBeInTheDocument()
    expect(screen.getByText('Ship — Binh')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Weekly')).toBeInTheDocument()
  })

  it('falls back when the content is not JSON', () => {
    render(<MeetingSummaryCard content="nope" />)
    expect(screen.getByText('summaryUnavailable')).toBeInTheDocument()
  })
})
