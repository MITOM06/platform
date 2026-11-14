import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'
import { useProfileImageEditor } from '@/lib/hooks/use-profile-image-editor'

let n = 0
const create = vi.fn(() => `blob:${++n}`)
const revoke = vi.fn()
const orig = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }

beforeEach(() => {
  n = 0; create.mockClear(); revoke.mockClear()
  URL.createObjectURL = create as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revoke
})
afterEach(() => {
  URL.createObjectURL = orig.create
  URL.revokeObjectURL = orig.revoke
})

const pick = (file?: File) => {
  const target = { files: file ? [file] : [], value: 'C:\\fake' }
  return { e: { target } as unknown as React.ChangeEvent<HTMLInputElement>, target }
}

describe('useProfileImageEditor', () => {
  it('picking an avatar opens the cropper and clears the input', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    const { e, target } = pick(new File(['x'], 'a.png'))
    act(() => result.current.handleAvatarPick(e))
    expect(target.value).toBe('')
    expect(result.current.cropTarget).toBe('avatar')
    expect(result.current.cropSourceUrl).toBe('blob:1')
  })

  it('picking nothing does not open the cropper', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    const { e, target } = pick()
    act(() => result.current.handleCoverPick(e))
    expect(target.value).toBe('')
    expect(result.current.cropTarget).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('confirming an avatar crop stages the blob and closes the cropper', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    act(() => result.current.handleAvatarPick(pick(new File(['x'], 'a.png')).e))
    const blob = new Blob(['cropped'])
    act(() => result.current.handleCropConfirm(blob))
    expect(result.current.avatarPreview).toBe('blob:2')
    expect(result.current.avatarBlob).toBe(blob)
    expect(result.current.cropTarget).toBeNull()
    expect(result.current.cropSourceUrl).toBeNull()
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })

  it('a second avatar crop revokes the previous preview', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    act(() => result.current.handleAvatarPick(pick(new File(['x'], 'a.png')).e))
    act(() => result.current.handleCropConfirm(new Blob(['1'])))
    act(() => result.current.handleAvatarPick(pick(new File(['y'], 'b.png')).e))
    act(() => result.current.handleCropConfirm(new Blob(['2'])))
    expect(revoke).toHaveBeenCalledWith('blob:2')
    expect(result.current.avatarPreview).toBe('blob:4')
  })

  it('cover crops stage the cover and revoke the old cover preview', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    act(() => result.current.handleCoverPick(pick(new File(['x'], 'c.png')).e))
    expect(result.current.cropTarget).toBe('cover')
    const b1 = new Blob(['1'])
    act(() => result.current.handleCropConfirm(b1))
    expect(result.current.coverBlob).toBe(b1)
    expect(result.current.coverPreview).toBe('blob:2')
    expect(result.current.avatarBlob).toBeNull()
    act(() => result.current.handleCoverPick(pick(new File(['y'], 'd.png')).e))
    act(() => result.current.handleCropConfirm(new Blob(['2'])))
    expect(revoke).toHaveBeenCalledWith('blob:2')
  })

  it('confirming with no target stages nothing', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    act(() => result.current.handleCropConfirm(new Blob(['x'])))
    expect(result.current.avatarBlob).toBeNull()
    expect(result.current.coverBlob).toBeNull()
  })

  it('closeCropper without a source does not revoke; setters reset blobs', () => {
    const { result } = renderHook(() => useProfileImageEditor())
    act(() => result.current.closeCropper())
    expect(revoke).not.toHaveBeenCalled()
    act(() => result.current.handleAvatarPick(pick(new File(['x'], 'a.png')).e))
    act(() => result.current.handleCropConfirm(new Blob(['1'])))
    act(() => result.current.setAvatarBlob(null))
    expect(result.current.avatarBlob).toBeNull()
  })
})
