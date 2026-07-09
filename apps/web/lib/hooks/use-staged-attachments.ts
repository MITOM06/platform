'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chatService } from '@/lib/api/chat'
import type { PendingAttachment } from '@/components/chat/MediaPreviewStrip'
import type { MessageType } from '@/lib/api/types'

function randomId() {
  return Math.random().toString(36).slice(2)
}

/**
 * Re-encode an image to JPEG at a lower quality for the SD ("not HD") path.
 * Falls back to the original file if the browser can't decode/encode it.
 */
async function compressImage(file: File, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const src = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(src)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(src)
      resolve(file)
    }
    img.src = src
  })
}

type SendFn = (content: string, type?: MessageType) => Promise<void>

/**
 * Owns the "stage first, upload on Send" attachment flow for the composer.
 * Images/videos are appended and previewed via object URLs; a document replaces
 * the strip (single-shot, like Zalo/Messenger). Object URLs are revoked on
 * remove, on flush, and on unmount so no blobs leak.
 */
export function useStagedAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  // Single global HD flag for the whole batch (default ON = original quality).
  const [isAllHD, setIsAllHD] = useState(true)

  // Mirror into a ref so unmount cleanup and flush see the *current* set
  // without re-subscribing effects on every change (which would revoke URLs
  // still shown). Synced in an effect — never written during render.
  const ref = useRef<PendingAttachment[]>([])
  useEffect(() => {
    ref.current = pendingAttachments
  }, [pendingAttachments])
  useEffect(
    () => () => {
      ref.current.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
      })
    },
    [],
  )

  const stageImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const newItems: PendingAttachment[] = files.map((file) => ({
      id: randomId(),
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }))
    setPendingAttachments((prev) => {
      // A staged document doesn't mix with media — replace it.
      if (prev[0]?.type === 'file') {
        prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
        return newItems
      }
      return [...prev, ...newItems]
    })
  }, [])

  const stageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingAttachments((prev) => {
      prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
      return [{ id: randomId(), file, previewUrl: '', type: 'file' }]
    })
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((a) => a.id === id)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const toggleAllHD = useCallback(() => setIsAllHD((v) => !v), [])

  /**
   * Upload every staged attachment then send it. Images are batched into one
   * message (single url, or JSON array for a gallery); videos/files send one
   * each. Throws on the first upload/send failure so the caller can surface a
   * localized error; the strip is only cleared on full success.
   */
  const flushAttachments = useCallback(async (onSend: SendFn) => {
    const items = ref.current
    if (items.length === 0) return
    const images: string[] = []
    for (const att of items) {
      if (att.type === 'file') {
        const { url, filename, size } = await chatService.uploadFile(att.file)
        await onSend(
          JSON.stringify({ url, name: filename || att.file.name, size: Number(size) || 0 }),
          'file',
        )
      } else if (att.type === 'video') {
        const { url } = await chatService.uploadFile(att.file)
        await onSend(url, 'video')
      } else {
        const fileToUpload = isAllHD ? att.file : await compressImage(att.file, 0.7)
        const { url } = await chatService.uploadFile(fileToUpload)
        images.push(url)
      }
    }
    if (images.length === 1) await onSend(images[0], 'image')
    else if (images.length > 1) await onSend(JSON.stringify(images), 'image')

    items.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    setPendingAttachments([])
    setIsAllHD(true) // reset to default (HD ON) for the next batch
  }, [isAllHD])

  return {
    pendingAttachments,
    isAllHD,
    stageImages,
    stageFile,
    removeAttachment,
    toggleAllHD,
    flushAttachments,
  }
}
