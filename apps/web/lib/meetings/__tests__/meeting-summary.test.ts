import { describe, it, expect } from 'vitest'
import { normalizeSummary } from '@/lib/meetings/meeting-summary'

describe('normalizeSummary', () => {
  it('reads the old group-call format (string action items)', () => {
    const s = normalizeSummary({
      attendees: ['An', 'Binh'], durationSec: 125, overview: 'o',
      keyPoints: ['k1'], actionItems: ['do x'],
    })
    expect(s).toEqual({
      overview: 'o', keyPoints: ['k1'], decisions: [],
      actionItems: [{ text: 'do x', assigneeName: null }],
      fromMaterials: [], attendees: ['An', 'Binh'], durationSec: 125, title: null,
    })
  })

  it('reads the new meeting format (object action items, decisions, materials)', () => {
    const s = normalizeSummary({
      meetingId: 'm1', title: 'Weekly', attendees: ['An'], durationSec: 60, overview: 'o',
      keyPoints: ['k'], decisions: ['d'], fromMaterials: ['slides.pdf'], language: 'vi',
      actionItems: [{ text: 'ship', assigneeName: 'An' }, { text: 'test', assigneeName: null }],
    })
    expect(s?.title).toBe('Weekly')
    expect(s?.decisions).toEqual(['d'])
    expect(s?.fromMaterials).toEqual(['slides.pdf'])
    expect(s?.actionItems).toEqual([
      { text: 'ship', assigneeName: 'An' },
      { text: 'test', assigneeName: null },
    ])
  })

  it('drops wrongly typed elements and empty text', () => {
    const s = normalizeSummary({
      keyPoints: ['ok', 3, null], decisions: [1, 'd'], attendees: ['a', {}],
      actionItems: ['x', 5, { text: 7 }, { text: '' }, { text: 'y', assigneeName: 9 }, null, '  '],
    })
    expect(s?.keyPoints).toEqual(['ok'])
    expect(s?.decisions).toEqual(['d'])
    expect(s?.attendees).toEqual(['a'])
    expect(s?.actionItems).toEqual([
      { text: 'x', assigneeName: null },
      { text: 'y', assigneeName: null },
    ])
  })

  it('defaults scalars and blank assignee/title', () => {
    const s = normalizeSummary({ title: '  ', actionItems: [{ text: 't', assigneeName: ' ' }], durationSec: -3 })
    expect(s).toMatchObject({ overview: '', durationSec: 0, title: null })
    expect(s?.actionItems).toEqual([{ text: 't', assigneeName: null }])
  })

  it('returns null for anything that is not an object', () => {
    for (const raw of [null, undefined, 'x', 3, [], true]) expect(normalizeSummary(raw)).toBeNull()
  })
})
