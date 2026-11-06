/**
 * Composer attachments: stage first, upload on Send. Oversized files are refused
 * before preview, a document never mixes with media, every preview URL is
 * revoked, images go out as one message (single URL or JSON list) and the SD
 * path re-encodes to JPEG (falling back to the original on failure).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'

const h = vi.hoisted(() => ({
  uploadFile: vi.fn(),
}))
vi.mock('@/lib/api/chat', () => ({
  MAX_UPLOAD_BYTES: 1000,
  chatService: { uploadFile: h.uploadFile },
}))

import { useStagedAttachments } from '@/lib/hooks/use-staged-attachments'

let blobN = 0
const created: string[] = []
const revoked: string[] = []
const origCreate = URL.createObjectURL
const origRevoke = URL.revokeObjectURL

function file(name: string, type: string, size = 10): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function changeEvent(files: File[]) {
  const target = { files, value: 'C:\\fakepath\\x' }
  return { e: { target } as unknown as React.ChangeEvent<HTMLInputElement>, target }
}

beforeEach(() => {
  vi.clearAllMocks()
  blobN = 0
  created.length = 0
  revoked.length = 0
  URL.createObjectURL = vi.fn(() => {
    const u = `blob:${++blobN}`
    created.push(u)
    return u
  })
  URL.revokeObjectURL = vi.fn((u: string) => {
    revoked.push(u)
  })
  h.uploadFile.mockImplementation(async (f: File) => ({
    url: `/api/uploads/${f.name}`,
    filename: f.name,
    size: String(f.size),
  }))
})

afterEach(() => {
  URL.createObjectURL = origCreate
  URL.revokeObjectURL = origRevoke
})

describe('staging', () => {
  it('empty selection is a no-op; an oversized file refuses the whole batch before preview', () => {
    const { result } = renderHook(() => useStagedAttachments())
    let r!: { tooLarge: boolean }
    act(() => { r = result.current.stageFiles([]) })
    expect(r).toEqual({ tooLarge: false })

    act(() => { r = result.current.stageFiles([file('a.png', 'image/png'), file('b.png', 'image/png', 1001)]) })
    expect(r).toEqual({ tooLarge: true })
    expect(result.current.pendingAttachments).toEqual([])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('stages images and videos with previews, appending to what is staged', () => {
    const { result } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('a.png', 'image/png')]) })
    act(() => { result.current.stageFiles([file('v.mp4', 'video/mp4')]) })
    expect(result.current.pendingAttachments.map((a) => [a.type, a.previewUrl])).toEqual([
      ['image', 'blob:1'],
      ['video', 'blob:2'],
    ])
  })

  it('picker input is cleared so the same file can be picked again', () => {
    const { result } = renderHook(() => useStagedAttachments())
    const { e, target } = changeEvent([file('a.png', 'image/png')])
    act(() => result.current.stageImages(e))
    expect(target.value).toBe('')
    expect(result.current.pendingAttachments).toHaveLength(1)
  })

  it('a document replaces staged media (and revokes their previews), and media replaces a document', () => {
    const { result } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('a.png', 'image/png')]) })
    act(() => result.current.stageFile(changeEvent([file('doc.pdf', 'application/pdf')]).e))
    expect(result.current.pendingAttachments.map((a) => a.type)).toEqual(['file'])
    expect(revoked).toEqual(['blob:1'])

    act(() => { result.current.stageFiles([file('b.png', 'image/png')]) })
    expect(result.current.pendingAttachments.map((a) => a.file.name)).toEqual(['b.png'])
  })

  it('an oversized or missing document is ignored', () => {
    const { result } = renderHook(() => useStagedAttachments())
    act(() => result.current.stageFile(changeEvent([file('big.pdf', 'application/pdf', 5000)]).e))
    act(() => result.current.stageFile(changeEvent([]).e))
    expect(result.current.pendingAttachments).toEqual([])
  })

  it('remove drops one item and revokes its preview', () => {
    const { result } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('a.png', 'image/png'), file('b.png', 'image/png')]) })
    const first = result.current.pendingAttachments[0]
    act(() => result.current.removeAttachment(first.id))
    expect(result.current.pendingAttachments.map((a) => a.file.name)).toEqual(['b.png'])
    expect(revoked).toEqual([first.previewUrl])
  })

  it('unmount revokes every remaining preview', () => {
    const { result, unmount } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('a.png', 'image/png'), file('b.png', 'image/png')]) })
    unmount()
    expect(revoked.sort()).toEqual(['blob:1', 'blob:2'])
  })
})

describe('flush on Send', () => {
  it('nothing staged → nothing sent', async () => {
    const send = vi.fn()
    const { result } = renderHook(() => useStagedAttachments())
    await act(() => result.current.flushAttachments(send))
    expect(send).not.toHaveBeenCalled()
  })

  it('one image → its URL as an image message', async () => {
    const send = vi.fn(async () => undefined)
    const { result } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('a.png', 'image/png')]) })
    await act(() => result.current.flushAttachments(send))
    expect(send).toHaveBeenCalledWith('/api/uploads/a.png', 'image')
    expect(result.current.pendingAttachments).toEqual([])
  })

  it('several images → ONE message with a JSON list; videos go one by one', async () => {
    const send = vi.fn(async () => undefined)
    const { result } = renderHook(() => useStagedAttachments())
    act(() => {
      result.current.stageFiles([file('a.png', 'image/png'), file('v.mp4', 'video/mp4'), file('b.png', 'image/png')])
    })
    await act(() => result.current.flushAttachments(send))
    expect(send.mock.calls).toEqual([
      ['/api/uploads/v.mp4', 'video'],
      [JSON.stringify(['/api/uploads/a.png', '/api/uploads/b.png']), 'image'],
    ])
    expect(result.current.pendingAttachments).toEqual([])
  })

  it('a document is sent as a file card payload (name + numeric size)', async () => {
    h.uploadFile.mockResolvedValue({ url: '/api/uploads/x', filename: '', size: 'n/a' })
    const send = vi.fn(async () => undefined)
    const { result } = renderHook(() => useStagedAttachments())
    act(() => result.current.stageFile(changeEvent([file('doc.pdf', 'application/pdf')]).e))
    await act(() => result.current.flushAttachments(send))
    expect(send).toHaveBeenCalledWith(JSON.stringify({ url: '/api/uploads/x', name: 'doc.pdf', size: 0 }), 'file')
  })

  it('a failed upload keeps the attachment staged (draft not lost)', async () => {
    h.uploadFile.mockRejectedValue(new Error('net'))
    const send = vi.fn()
    const { result } = renderHook(() => useStagedAttachments())
    act(() => { result.current.stageFiles([file('v.mp4', 'video/mp4')]) })
    await expect(act(() => result.current.flushAttachments(send))).rejects.toThrow('net')
    expect(send).not.toHaveBeenCalled()
    expect(result.current.pendingAttachments).toHaveLength(1)
  })

  describe('SD (not HD) images', () => {
    const OrigImage = globalThis.Image
    let mode: 'load' | 'error' = 'load'
    let blobOut: Blob | null = new Blob(['jpg'], { type: 'image/jpeg' })
    let ctxOut: unknown = { drawImage: vi.fn() }

    beforeEach(() => {
      mode = 'load'
      blobOut = new Blob(['jpg'], { type: 'image/jpeg' })
      ctxOut = { drawImage: vi.fn() }
      class FakeImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        width = 4
        height = 3
        set src(_v: string) {
          queueMicrotask(() => (mode === 'load' ? this.onload?.() : this.onerror?.()))
        }
      }
      globalThis.Image = FakeImage as unknown as typeof Image
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctxOut as never)
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
        cb(blobOut)
      })
    })
    afterEach(() => {
      globalThis.Image = OrigImage
      vi.restoreAllMocks()
    })

    async function flushSd() {
      const send = vi.fn(async () => undefined)
      const { result } = renderHook(() => useStagedAttachments())
      act(() => { result.current.stageFiles([file('photo.png', 'image/png')]) })
      act(() => result.current.toggleAllHD())
      expect(result.current.isAllHD).toBe(false)
      await act(() => result.current.flushAttachments(send))
      expect(result.current.isAllHD).toBe(true) // reset after send
      return h.uploadFile.mock.calls[0][0] as File
    }

    it('re-encodes to JPEG', async () => {
      const uploaded = await flushSd()
      expect(uploaded.name).toBe('photo.jpg')
      expect(uploaded.type).toBe('image/jpeg')
    })

    it('falls back to the original when decoding fails, no 2D context, or no blob', async () => {
      mode = 'error'
      expect((await flushSd()).name).toBe('photo.png')

      mode = 'load'
      ctxOut = null
      h.uploadFile.mockClear()
      expect((await flushSd()).name).toBe('photo.png')

      ctxOut = { drawImage: vi.fn() }
      blobOut = null
      h.uploadFile.mockClear()
      expect((await flushSd()).name).toBe('photo.png')
    })
  })
})
