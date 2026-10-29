import { describe, it, expect } from 'vitest'
import { SKILLS, missingConnectors } from '@/lib/skills'

describe('skill readiness', () => {
  const scheduler = SKILLS.find((s) => s.id === 'scheduler')!

  it('is ready once every required connector is connected', () => {
    const connections = [
      { provider: 'calendar', status: 'active' },
      { provider: 'gmail', status: 'active' },
    ]
    expect(missingConnectors(scheduler.requires, connections)).toEqual([])
  })

  it('lists what is still missing; an expired connection does not count', () => {
    const connections = [
      { provider: 'calendar', status: 'active' },
      { provider: 'gmail', status: 'expired' },
    ]
    expect(missingConnectors(scheduler.requires, connections)).toEqual(['gmail'])
    expect(missingConnectors(scheduler.requires, [])).toEqual(['calendar', 'gmail'])
  })

  it('a skill without required connectors is always ready', () => {
    expect(missingConnectors([], [])).toEqual([])
  })
})
