import { describe, it, expect } from 'vitest'
import { computeStage, gridColumns, type StageInput } from '@/lib/meetings/stage-layout'

const base: StageInput = { mode: 'grid', pinnedKey: null, localIdentity: 'me', remoteIds: ['a', 'b'],
  screenSharers: [], activeSpeakerId: null, maxTiles: 25 }
const keys = (tiles: { key: string }[]) => tiles.map((t) => t.key)

describe('computeStage', () => {
  it('grid: me first, then people in join order', () => {
    const s = computeStage(base)
    expect(s.main).toBeNull()
    expect(keys(s.grid)).toEqual(['me:camera', 'a:camera', 'b:camera'])
    expect(s).toMatchObject({ overflow: 0, hiddenIds: [], strip: [] })
  })

  it('a pinned tile takes the stage', () => {
    const s = computeStage({ ...base, pinnedKey: 'b:camera' })
    expect(s.main?.key).toBe('b:camera')
    expect(keys(s.strip)).toEqual(['me:camera', 'a:camera'])
    expect(s.grid).toEqual([])
  })

  it('ignores a pin on someone who left', () => {
    expect(computeStage({ ...base, pinnedKey: 'gone:camera' }).main).toBeNull()
  })

  it('a remote screen share always takes the stage, cameras go to the strip', () => {
    const s = computeStage({ ...base, screenSharers: ['a'] })
    expect(s.main).toMatchObject({ key: 'a:screen', kind: 'screen', isLocal: false })
    expect(keys(s.strip)).toEqual(['me:camera', 'a:camera', 'b:camera'])
  })

  it('a pin beats a share; my own share is staged only when nobody else shares', () => {
    expect(computeStage({ ...base, screenSharers: ['a'], pinnedKey: 'b:camera' }).main?.key).toBe('b:camera')
    expect(computeStage({ ...base, screenSharers: ['me'] }).main).toMatchObject({ key: 'me:screen', isLocal: true })
    const both = computeStage({ ...base, screenSharers: ['me', 'b'] })
    expect(both.main?.key).toBe('b:screen')
    expect(keys(both.strip)).toContain('me:screen')
  })

  it('spotlight follows the active speaker, then the first person, then me', () => {
    expect(computeStage({ ...base, mode: 'spotlight', activeSpeakerId: 'b' }).main?.key).toBe('b:camera')
    expect(computeStage({ ...base, mode: 'spotlight' }).main?.key).toBe('a:camera')
    expect(computeStage({ ...base, mode: 'spotlight', remoteIds: [] }).main?.key).toBe('me:camera')
    expect(computeStage({ ...base, mode: 'spotlight', activeSpeakerId: 'me' }).main?.key).toBe('a:camera')
  })

  it('overflows past capacity and keeps the active speaker visible', () => {
    const many = { ...base, remoteIds: ['a', 'b', 'c', 'd', 'e'], maxTiles: 4 }
    const s = computeStage(many)
    expect(keys(s.grid)).toEqual(['me:camera', 'a:camera', 'b:camera'])
    expect(s.overflow).toBe(3)
    expect(s.hiddenIds).toEqual(['c', 'd', 'e'])

    const talking = computeStage({ ...many, activeSpeakerId: 'e' })
    expect(keys(talking.grid)).toEqual(['me:camera', 'a:camera', 'e:camera'])
    expect(talking.hiddenIds).toEqual(['b', 'c', 'd'])
  })
})

describe('gridColumns', () => {
  it.each([[1, 1], [2, 1], [3, 2], [6, 2]])('phone %i tiles → %i columns', (n, cols) => {
    expect(gridColumns(n, true)).toBe(cols)
  })
  it.each([[1, 1], [2, 2], [4, 2], [5, 3], [9, 3], [10, 4], [16, 4], [17, 5], [25, 5]])(
    'desktop %i tiles → %i columns', (n, cols) => {
      expect(gridColumns(n, false)).toBe(cols)
    })
})
