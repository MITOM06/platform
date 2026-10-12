import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useVideoFit } from '../use-video-fit'

let observers: Array<{ cb: ResizeObserverCallback; target?: Element }> = []

beforeEach(() => {
  observers = []
  globalThis.ResizeObserver = class {
    private entry: { cb: ResizeObserverCallback; target?: Element }
    constructor(cb: ResizeObserverCallback) {
      this.entry = { cb }
      observers.push(this.entry)
    }
    observe(target: Element) {
      this.entry.target = target
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})
afterEach(() => {
  observers = []
})

function Probe() {
  const ref = useRef<HTMLVideoElement>(null)
  const { fit, videoSize } = useVideoFit(ref)
  return (
    <>
      <video ref={ref} data-testid="v" />
      <span data-testid="fit">{fit}</span>
      <span data-testid="size">{videoSize ? `${videoSize.width}x${videoSize.height}` : 'none'}</span>
    </>
  )
}

function setFrame(video: HTMLVideoElement, width: number, height: number, event: 'loadedmetadata' | 'resize') {
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true })
  act(() => {
    video.dispatchEvent(new Event(event))
  })
}

function setBox(video: HTMLVideoElement, width: number, height: number) {
  Object.defineProperty(video, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(video, 'clientHeight', { value: height, configurable: true })
  act(() => {
    observers.forEach((o) => o.cb([] as unknown as ResizeObserverEntry[], {} as ResizeObserver))
  })
}

describe('useVideoFit', () => {
  it('shows a portrait phone picture whole on a landscape screen, and follows a rotation', () => {
    render(<Probe />)
    const video = screen.getByTestId('v') as HTMLVideoElement
    expect(screen.getByTestId('fit').textContent).toBe('cover')

    setBox(video, 1920, 1080)
    setFrame(video, 720, 1280, 'loadedmetadata')
    expect(screen.getByTestId('fit').textContent).toBe('contain')
    expect(screen.getByTestId('size').textContent).toBe('720x1280')

    // The phone turns sideways: the stream's frames become landscape.
    setFrame(video, 1280, 720, 'resize')
    expect(screen.getByTestId('fit').textContent).toBe('cover')
  })

  it('re-evaluates when the box changes shape (window resized, phone rotated)', () => {
    render(<Probe />)
    const video = screen.getByTestId('v') as HTMLVideoElement
    setFrame(video, 1280, 720, 'loadedmetadata')
    setBox(video, 1280, 720)
    expect(screen.getByTestId('fit').textContent).toBe('cover')

    setBox(video, 390, 844)
    expect(screen.getByTestId('fit').textContent).toBe('contain')
  })
})
