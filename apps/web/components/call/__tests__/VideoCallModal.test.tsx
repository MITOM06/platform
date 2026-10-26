import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('../CallConnectionNotice', () => ({ CallConnectionNotice: () => null }))
vi.mock('../CallReconnectOverlay', () => ({ CallReconnectOverlay: () => null }))
vi.mock('@/lib/webrtc/call-manager', () => ({
  callManager: { getLocalStream: () => null, getRemoteStream: () => null, onLocalStream: null, onRemoteStream: null },
}))

import { VideoCallModal } from '../VideoCallModal'
import { useCallStore } from '@/lib/store/call.store'

const observers: Array<() => void> = []

beforeEach(() => {
  observers.length = 0
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      observers.push(cb)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  useCallStore.setState({ status: 'connected', peerName: 'Lan', peerCamera: true, cameraEnabled: true, micEnabled: true })
})

function frame(video: HTMLVideoElement, size: [number, number], box: [number, number]) {
  Object.defineProperty(video, 'clientWidth', { value: box[0], configurable: true })
  Object.defineProperty(video, 'clientHeight', { value: box[1], configurable: true })
  Object.defineProperty(video, 'videoWidth', { value: size[0], configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: size[1], configurable: true })
  act(() => {
    observers.forEach((cb) => cb())
    video.dispatchEvent(new Event('loadedmetadata'))
  })
}

/**
 * A phone (portrait camera) calling a laptop (landscape screen): the full-screen
 * `cover` kept about a third of the phone's picture, and the self-view was a
 * fixed portrait box that cropped a laptop camera.
 */
describe('VideoCallModal video shape', () => {
  it("shows the other side's portrait camera whole on a landscape screen", () => {
    const { container } = render(<VideoCallModal />)
    const [remote] = Array.from(container.querySelectorAll('video'))
    frame(remote, [720, 1280], [1440, 900])
    expect(remote.className).toContain('object-contain')

    frame(remote, [1280, 720], [1440, 900])
    expect(remote.className).toContain('object-cover')
  })

  it('shapes the self-view like our own camera', () => {
    const { container } = render(<VideoCallModal />)
    const local = container.querySelectorAll('video')[1]
    frame(local, [1280, 720], [160, 90])
    expect(local.style.width).toBe('160px')
    expect(local.style.height).toBe('90px')

    frame(local, [720, 1280], [90, 160])
    expect(local.style.width).toBe('90px')
    expect(local.style.height).toBe('160px')
  })
})
