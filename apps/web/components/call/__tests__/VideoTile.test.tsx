import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { VideoTile } from '@/components/call/VideoTile'

describe('VideoTile', () => {
  it('keeps the call tile unchanged when only the call props are set', () => {
    const { container } = render(<VideoTile stream={null} name="lan" video={false} muted={false} label="Lan (you)" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toBe(
      'relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-900',
    )
    expect(container.querySelector('video')?.className).toBe('h-full w-full object-cover opacity-0')
    expect(screen.getByText('L')).toBeTruthy()
    expect(screen.getByText('Lan (you)')).toBeTruthy()
    expect(root.children).toHaveLength(3) // video, avatar, label — no badge slot
  })

  it('adds badges, contain-fit and extra classes for meetings', () => {
    const { container } = render(
      <VideoTile stream={null} name="Minh" video muted fit="contain" className="h-full aspect-auto" badges={<span>badge</span>} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('aspect-auto')
    expect(root.className).not.toContain('aspect-video')
    expect(container.querySelector('video')?.className).toContain('object-contain')
    expect(screen.getByText('badge')).toBeTruthy()
  })

  describe('fit follows the picture', () => {
    let resize: (() => void) | null = null
    beforeEach(() => {
      resize = null
      globalThis.ResizeObserver = class {
        constructor(cb: () => void) {
          resize = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver
    })

    function show(video: HTMLVideoElement, frame: [number, number], box: [number, number]) {
      Object.defineProperty(video, 'clientWidth', { value: box[0], configurable: true })
      Object.defineProperty(video, 'clientHeight', { value: box[1], configurable: true })
      Object.defineProperty(video, 'videoWidth', { value: frame[0], configurable: true })
      Object.defineProperty(video, 'videoHeight', { value: frame[1], configurable: true })
      act(() => {
        resize?.()
        video.dispatchEvent(new Event('loadedmetadata'))
      })
    }

    it('shows a phone\'s portrait camera whole in a landscape tile', () => {
      const { container } = render(<VideoTile stream={null} name="lan" video muted={false} />)
      const video = container.querySelector('video') as HTMLVideoElement
      show(video, [720, 1280], [640, 360])
      expect(video.className).toContain('object-contain')
      expect(video.className).not.toContain('object-cover')
    })

    it('keeps filling the tile with a landscape camera', () => {
      const { container } = render(<VideoTile stream={null} name="lan" video muted={false} />)
      const video = container.querySelector('video') as HTMLVideoElement
      show(video, [1280, 720], [640, 360])
      expect(video.className).toContain('object-cover')
    })

    it('an explicit fit wins (screen shares stay contain, whatever their shape)', () => {
      const { container } = render(<VideoTile stream={null} name="lan" video muted={false} fit="cover" />)
      const video = container.querySelector('video') as HTMLVideoElement
      show(video, [720, 1280], [640, 360])
      expect(video.className).toContain('object-cover')
    })
  })
})
