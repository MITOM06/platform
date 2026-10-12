import { describe, expect, it } from 'vitest'
import { coverVisibleShare, pipSize, videoFit } from '../video-fit'

const phonePortrait = { width: 720, height: 1280 }
const laptopLandscape = { width: 1280, height: 720 }
const desktopScreen = { width: 1920, height: 1080 }
const phoneScreen = { width: 390, height: 844 }

/**
 * A phone sends portrait video, a laptop landscape. Filling the other side's
 * screen with `cover` kept ~32% of a portrait frame on a desktop (a zoomed-in
 * slice of the face) and cut both sides of a laptop picture on a phone.
 */
describe('videoFit', () => {
  it('shows the whole frame when cover would crop most of it', () => {
    expect(coverVisibleShare(phonePortrait, desktopScreen)).toBeCloseTo(0.316, 2)
    expect(videoFit(phonePortrait, desktopScreen)).toBe('contain')
    expect(videoFit(laptopLandscape, phoneScreen)).toBe('contain')
  })

  it('fills the screen when the shapes are close', () => {
    expect(videoFit(laptopLandscape, desktopScreen)).toBe('cover')
    expect(videoFit(phonePortrait, phoneScreen)).toBe('cover')
    // 16:9 in a 4:3 box keeps 75% of the frame: still worth filling.
    expect(videoFit({ width: 1600, height: 900 }, { width: 800, height: 600 })).toBe('cover')
  })

  it('falls back to cover until both sizes are known', () => {
    expect(videoFit(null, desktopScreen)).toBe('cover')
    expect(videoFit(phonePortrait, null)).toBe('cover')
    expect(videoFit({ width: 0, height: 0 }, desktopScreen)).toBe('cover')
  })
})

describe('pipSize', () => {
  it('follows the camera: portrait for a phone, landscape for a laptop', () => {
    expect(pipSize(phonePortrait)).toEqual({ width: 90, height: 160 })
    expect(pipSize(laptopLandscape)).toEqual({ width: 160, height: 90 })
  })

  it('is portrait until the camera size is known', () => {
    expect(pipSize(null)).toEqual({ width: 112, height: 160 })
  })
})
