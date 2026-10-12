/** Width and height in pixels (a video frame, or the box it is shown in). */
export interface Size {
  width: number
  height: number
}

/**
 * Below this share of the frame left visible by `cover`, the whole frame is
 * shown instead (`contain`, black bars). 16:9 in a 4:3 box keeps 75%.
 */
export const MIN_COVER_VISIBLE = 0.75

const known = (s: Size | null | undefined): s is Size => !!s && s.width > 0 && s.height > 0

/** Share of the frame (0–1) still visible when `video` covers `box`. */
export function coverVisibleShare(video: Size, box: Size): number {
  const v = video.width / video.height
  const b = box.width / box.height
  return Math.min(v, b) / Math.max(v, b)
}

/**
 * How to fit a call video in its box. A phone sends portrait video and a laptop
 * landscape: covering the other side's screen kept about a third of a portrait
 * frame on a desktop, so a mismatched shape is shown whole. Cover until both
 * sizes are known.
 */
export function videoFit(video: Size | null | undefined, box: Size | null | undefined): 'cover' | 'contain' {
  if (!known(video) || !known(box)) return 'cover'
  return coverVisibleShare(video, box) < MIN_COVER_VISIBLE ? 'contain' : 'cover'
}

/** Self-view size: the camera's own shape, longest side `long` px (portrait until known). */
export function pipSize(video: Size | null | undefined, long = 160): Size {
  if (!known(video)) return { width: 112, height: long }
  const short = Math.round((long * Math.min(video.width, video.height)) / Math.max(video.width, video.height))
  return video.width >= video.height ? { width: long, height: short } : { width: short, height: long }
}
