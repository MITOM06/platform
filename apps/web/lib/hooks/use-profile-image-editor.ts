'use client'

import { useRef, useState } from 'react'

export type CropTarget = 'avatar' | 'cover' | null

// Owns the staged (not-yet-uploaded) avatar/cover image editing + cropper state
// for the edit-profile page. Extracted to keep the page under the 400-line
// limit; behaviour is identical to the inline version.
export function useProfileImageEditor() {
  // Staged (not-yet-uploaded) image edits — only persisted on explicit Save Changes.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Cropper modal state
  const [cropTarget, setCropTarget] = useState<CropTarget>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)

  const openCropper = (target: CropTarget, file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setCropSourceUrl(objectUrl)
    setCropTarget(target)
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) openCropper('avatar', file)
  }

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) openCropper('cover', file)
  }

  const closeCropper = () => {
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    setCropSourceUrl(null)
    setCropTarget(null)
  }

  const handleCropConfirm = (blob: Blob) => {
    const previewUrl = URL.createObjectURL(blob)
    if (cropTarget === 'avatar') {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(previewUrl)
      setAvatarBlob(blob)
    } else if (cropTarget === 'cover') {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      setCoverPreview(previewUrl)
      setCoverBlob(blob)
    }
    closeCropper()
  }

  return {
    avatarPreview,
    avatarBlob, setAvatarBlob,
    coverPreview,
    coverBlob, setCoverBlob,
    avatarInputRef,
    coverInputRef,
    cropTarget,
    cropSourceUrl,
    handleAvatarPick,
    handleCoverPick,
    closeCropper,
    handleCropConfirm,
  }
}
