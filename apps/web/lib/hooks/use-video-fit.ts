'use client'

import { useEffect, useState, type RefObject } from 'react'
import { videoFit, type Size } from '@/lib/webrtc/video-fit'

const sameSize = (a: Size | null, b: Size | null) =>
  a === b || (!!a && !!b && a.width === b.width && a.height === b.height)

/**
 * The fit (`cover` / `contain`) for a call `<video>` that fills its box: tracks
 * the frame size (`loadedmetadata`, and `resize` when the sender's phone
 * rotates) and the element's own box (ResizeObserver). See `videoFit`.
 */
export function useVideoFit(ref: RefObject<HTMLVideoElement | null>): {
  fit: 'cover' | 'contain'
  videoSize: Size | null
} {
  const [videoSize, setVideoSize] = useState<Size | null>(null)
  const [boxSize, setBoxSize] = useState<Size | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const readFrame = () => {
      const next = el.videoWidth > 0 && el.videoHeight > 0 ? { width: el.videoWidth, height: el.videoHeight } : null
      setVideoSize((prev) => (sameSize(prev, next) ? prev : next))
    }
    const readBox = () => {
      const next = el.clientWidth > 0 && el.clientHeight > 0 ? { width: el.clientWidth, height: el.clientHeight } : null
      setBoxSize((prev) => (sameSize(prev, next) ? prev : next))
    }
    readFrame()
    readBox()
    el.addEventListener('loadedmetadata', readFrame)
    el.addEventListener('resize', readFrame)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(readBox)
    observer?.observe(el)
    return () => {
      el.removeEventListener('loadedmetadata', readFrame)
      el.removeEventListener('resize', readFrame)
      observer?.disconnect()
    }
  }, [ref])

  return { fit: videoFit(videoSize, boxSize), videoSize }
}
