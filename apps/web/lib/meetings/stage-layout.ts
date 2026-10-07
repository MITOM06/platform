/**
 * Who is on the meeting stage, and where. Pure: the stage component feeds it
 * the people in the room and renders the result.
 *
 * Priority for the big tile: a pin → someone else's screen share → my own
 * share → (speaker mode) the active speaker → nothing (grid).
 */

export type LayoutMode = 'grid' | 'spotlight'

export interface StageTile {
  key: string
  identity: string
  kind: 'camera' | 'screen'
  isLocal: boolean
}

export interface StageInput {
  mode: LayoutMode
  pinnedKey: string | null
  localIdentity: string
  remoteIds: string[]
  screenSharers: string[]
  activeSpeakerId: string | null
  /** Grid capacity including the "+N" tile: 25 desktop, 6 phone. */
  maxTiles: number
}

export interface StageLayout {
  main: StageTile | null
  strip: StageTile[]
  grid: StageTile[]
  /** People not shown in the grid (the "+N" tile). */
  overflow: number
  /** Remote identities without a tile — stop receiving their camera. */
  hiddenIds: string[]
}

export const cameraKey = (identity: string): string => `${identity}:camera`
export const screenKey = (identity: string): string => `${identity}:screen`

function tile(identity: string, kind: StageTile['kind'], local: string): StageTile {
  return {
    key: kind === 'camera' ? cameraKey(identity) : screenKey(identity),
    identity,
    kind,
    isLocal: identity === local,
  }
}

function pickMain(i: StageInput, cameras: StageTile[], screens: StageTile[]): StageTile | null {
  const all = [...screens, ...cameras]
  const pinned = i.pinnedKey ? all.find((t) => t.key === i.pinnedKey) : undefined
  if (pinned) return pinned
  const remoteShare = screens.find((t) => !t.isLocal)
  if (remoteShare) return remoteShare
  if (screens.length) return screens[0]
  if (i.mode !== 'spotlight') return null
  const remotes = cameras.filter((t) => !t.isLocal)
  const speaker = remotes.find((t) => t.identity === i.activeSpeakerId)
  return speaker ?? remotes[0] ?? cameras[0] ?? null
}

/** Grid with a capacity: me first, people in join order, the active speaker kept visible. */
function fitGrid(i: StageInput, cameras: StageTile[]): Pick<StageLayout, 'grid' | 'overflow' | 'hiddenIds'> {
  const max = Math.max(1, i.maxTiles)
  if (cameras.length <= max) return { grid: cameras, overflow: 0, hiddenIds: [] }
  const [me, ...remotes] = cameras
  const slots = Math.max(0, max - 2) // minus me, minus the "+N" tile
  let visible = remotes.slice(0, slots)
  const speaker = remotes.find((t) => t.identity === i.activeSpeakerId)
  if (speaker && slots > 0 && !visible.includes(speaker)) {
    visible = [...visible.slice(0, slots - 1), speaker]
  }
  const hidden = remotes.filter((t) => !visible.includes(t))
  return { grid: [me, ...visible], overflow: hidden.length, hiddenIds: hidden.map((t) => t.identity) }
}

export function computeStage(i: StageInput): StageLayout {
  const people = [i.localIdentity, ...i.remoteIds.filter((id) => id !== i.localIdentity)]
  const present = new Set(people)
  const cameras = people.map((id) => tile(id, 'camera', i.localIdentity))
  const screens = i.screenSharers
    .filter((id, idx, arr) => present.has(id) && arr.indexOf(id) === idx)
    .map((id) => tile(id, 'screen', i.localIdentity))

  const main = pickMain(i, cameras, screens)
  if (main) {
    const strip = [...screens, ...cameras].filter((t) => t.key !== main.key)
    return { main, strip: orderStrip(strip), grid: [], overflow: 0, hiddenIds: [] }
  }
  return { main: null, strip: [], ...fitGrid(i, cameras) }
}

/** Cameras in join order, then any other screen shares. */
function orderStrip(tiles: StageTile[]): StageTile[] {
  return [...tiles.filter((t) => t.kind === 'camera'), ...tiles.filter((t) => t.kind === 'screen')]
}

/** Columns for `count` grid tiles: phone 1–2, desktop the smallest square that fits. */
export function gridColumns(count: number, mobile: boolean): number {
  if (count <= 1) return 1
  if (mobile) return count <= 2 ? 1 : 2
  return Math.ceil(Math.sqrt(count))
}
