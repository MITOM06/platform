import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDomScreenCapture } from '@/lib/meetings/screen-capture'

type FakeVideo = {
  muted: boolean; playsInline: boolean; srcObject: unknown
  readyState: number; videoWidth: number; videoHeight: number
  play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>
}
type FakeCtx = { drawImage: ReturnType<typeof vi.fn>; getImageData: ReturnType<typeof vi.fn> }
type FakeCanvas = {
  width: number; height: number
  getContext: ReturnType<typeof vi.fn>
  toBlob: ReturnType<typeof vi.fn>
}

let video: FakeVideo
let canvases: FakeCanvas[]
let ctx: FakeCtx | null
const realCreate = document.createElement.bind(document)

beforeEach(() => {
  canvases = []
  ctx = {
    drawImage: vi.fn(),
    // every pixel RGB = (100, 200, 50)
    getImageData: vi.fn((_x: number, _y: number, w: number, hh: number) => {
      const data = new Uint8ClampedArray(w * hh * 4)
      for (let i = 0; i < w * hh; i++) data.set([100, 200, 50, 255], i * 4)
      return { data }
    }),
  }
  video = {
    muted: false, playsInline: false, srcObject: null,
    readyState: 4, videoWidth: 2560, videoHeight: 1440,
    play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
  }
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'video') return video
    if (tag === 'canvas') {
      const c: FakeCanvas = {
        width: 0, height: 0,
        getContext: vi.fn(() => ctx),
        toBlob: vi.fn((cb: (b: Blob | null) => void, type: string, q: number) => cb(new Blob([`${type}|${q}`]))),
      }
      canvases.push(c)
      return c
    }
    return realCreate(tag)
  }) as typeof document.createElement)
})
afterEach(() => vi.restoreAllMocks())

const stream = {} as MediaStream

describe('createDomScreenCapture', () => {
  it('wires a muted inline video to the stream and plays it (play rejection swallowed)', async () => {
    video.play.mockRejectedValue(new Error('autoplay'))
    createDomScreenCapture(stream)
    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.srcObject).toBe(stream)
    expect(video.play).toHaveBeenCalled()
    await Promise.resolve()
  })

  it('returns null thumbnail / frame while the video has no frame', async () => {
    video.readyState = 1
    const cap = createDomScreenCapture(stream)
    expect(cap.thumbnail()).toBeNull()
    await expect(cap.frame()).resolves.toBeNull()
    video.readyState = 4; video.videoWidth = 0
    expect(cap.thumbnail()).toBeNull()
  })

  it('thumbnail is a 32x18 luma array', () => {
    const cap = createDomScreenCapture(stream)
    const gray = cap.thumbnail()!
    expect(gray).toHaveLength(32 * 18)
    expect(gray[0]).toBe(Math.round(0.299 * 100 + 0.587 * 200 + 0.114 * 50))
    expect(canvases[0].width).toBe(32)
    expect(canvases[0].height).toBe(18)
    expect(canvases[0].getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true })
    expect(ctx!.drawImage).toHaveBeenCalledWith(video, 0, 0, 32, 18)
  })

  it('frame scales the long edge down to 1280 and encodes JPEG q0.7', async () => {
    const cap = createDomScreenCapture(stream)
    const blob = await cap.frame()
    expect(canvases[0].width).toBe(1280)
    expect(canvases[0].height).toBe(720)
    expect(await blob!.text()).toBe('image/jpeg|0.7')
  })

  it('frame never upscales a small video', async () => {
    video.videoWidth = 640; video.videoHeight = 360
    const cap = createDomScreenCapture(stream)
    await cap.frame()
    expect([canvases[0].width, canvases[0].height]).toEqual([640, 360])
  })

  it('no 2d context → null', async () => {
    ctx = null
    const cap = createDomScreenCapture(stream)
    expect(cap.thumbnail()).toBeNull()
    await expect(cap.frame()).resolves.toBeNull()
  })

  it('dispose pauses and detaches the stream', () => {
    const cap = createDomScreenCapture(stream)
    cap.dispose()
    expect(video.pause).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
  })
})
