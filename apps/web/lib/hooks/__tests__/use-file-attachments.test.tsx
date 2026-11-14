import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'

const h = vi.hoisted(() => ({ upload: vi.fn(), toast: { error: vi.fn() } }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/chat', () => ({ chatService: { uploadFile: h.upload }, FILE_TOO_LARGE: 'FILE_TOO_LARGE' }))

import { useFileAttachments } from '@/lib/hooks/use-file-attachments'

const ev = (files: File[]) => {
  const target = { files, value: 'x' }
  return { e: { target } as unknown as React.ChangeEvent<HTMLInputElement>, target }
}
const img = (n: string) => new File(['i'], n, { type: 'image/png' })

function setup() {
  const onSend = vi.fn()
  const onUploadingChange = vi.fn()
  const { result } = renderHook(() =>
    useFileAttachments({ onSend, onUploadingChange, uploadErrorLabel: 'UPLOAD_ERR', tooLargeLabel: 'TOO_LARGE' }))
  return { result, onSend, onUploadingChange }
}

beforeEach(() => {
  h.toast.error.mockReset()
  h.upload.mockReset().mockImplementation(async (f: File) => ({ url: `u/${f.name}`, filename: f.name, size: '42' }))
})

describe('handleImagePick', () => {
  it('no files → nothing happens, input cleared', async () => {
    const { result, onUploadingChange } = setup()
    const { e, target } = ev([])
    await act(async () => { await result.current.handleImagePick(e) })
    expect(target.value).toBe('')
    expect(onUploadingChange).not.toHaveBeenCalled()
  })

  it('one image → single image message', async () => {
    const { result, onSend, onUploadingChange } = setup()
    await act(async () => { await result.current.handleImagePick(ev([img('a.png')]).e) })
    expect(onSend).toHaveBeenCalledWith('u/a.png', 'image')
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]])
  })

  it('several images → one JSON album; videos go out individually', async () => {
    const { result, onSend } = setup()
    const video = new File(['v'], 'v.mp4', { type: 'video/mp4' })
    await act(async () => { await result.current.handleImagePick(ev([img('a.png'), video, img('b.png')]).e) })
    expect(onSend.mock.calls).toEqual([
      ['u/v.mp4', 'video'],
      [JSON.stringify(['u/a.png', 'u/b.png']), 'image'],
    ])
  })

  it('only videos → no image message', async () => {
    const { result, onSend } = setup()
    await act(async () => { await result.current.handleImagePick(ev([new File(['v'], 'v.webm', { type: 'video/webm' })]).e) })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('too-large upload → too-large toast; other errors → generic', async () => {
    const { result, onUploadingChange } = setup()
    h.upload.mockRejectedValueOnce(new Error('FILE_TOO_LARGE'))
    await act(async () => { await result.current.handleImagePick(ev([img('a.png')]).e) })
    expect(h.toast.error).toHaveBeenLastCalledWith('TOO_LARGE')
    expect(onUploadingChange).toHaveBeenLastCalledWith(false)
    h.upload.mockRejectedValueOnce('string failure')
    await act(async () => { await result.current.handleImagePick(ev([img('a.png')]).e) })
    expect(h.toast.error).toHaveBeenLastCalledWith('UPLOAD_ERR')
  })
})

describe('handleFilePick', () => {
  it('no file → nothing', async () => {
    const { result, onUploadingChange } = setup()
    await act(async () => { await result.current.handleFilePick(ev([]).e) })
    expect(onUploadingChange).not.toHaveBeenCalled()
  })

  it('sends a file message with numeric size and server filename', async () => {
    const { result, onSend } = setup()
    await act(async () => { await result.current.handleFilePick(ev([new File(['d'], 'doc.pdf')]).e) })
    expect(onSend).toHaveBeenCalledWith(JSON.stringify({ url: 'u/doc.pdf', name: 'doc.pdf', size: 42 }), 'file')
  })

  it('falls back to the local name and size 0 when the server omits them', async () => {
    h.upload.mockResolvedValueOnce({ url: 'u/x', filename: '', size: 'n/a' })
    const { result, onSend } = setup()
    await act(async () => { await result.current.handleFilePick(ev([new File(['d'], 'local.txt')]).e) })
    expect(onSend).toHaveBeenCalledWith(JSON.stringify({ url: 'u/x', name: 'local.txt', size: 0 }), 'file')
  })

  it('upload error toasts and resets uploading', async () => {
    h.upload.mockRejectedValueOnce(new Error('500'))
    const { result, onSend, onUploadingChange } = setup()
    await act(async () => { await result.current.handleFilePick(ev([new File(['d'], 'a')]).e) })
    expect(h.toast.error).toHaveBeenCalledWith('UPLOAD_ERR')
    expect(onSend).not.toHaveBeenCalled()
    expect(onUploadingChange).toHaveBeenLastCalledWith(false)
  })
})
