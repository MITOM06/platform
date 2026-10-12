
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chatService, MAX_UPLOAD_BYTES } from '@/lib/api/chat'
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

type StageFilesResult = {
  tooLarge: boolean
}

/**
 * Owns the "stage first, upload on Send" attachment flow for the composer.
 */
export function useStagedAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [isAllHD, setIsAllHD] = useState(true)

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

  /**
   * Stage images/videos from either the file picker or clipboard.
   * Files over the existing upload limit are rejected before previewing.
   */
  const stageFiles = useCallback((files: File[]): StageFilesResult => {
    if (files.length === 0) {
      return { tooLarge: false }
    }

    if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
      return { tooLarge: true }
    }

    const newItems: PendingAttachment[] = files.map((file) => ({
      id: randomId(),
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }))

    setPendingAttachments((prev) => {
      // A staged document doesn't mix with media — replace it.
      if (prev[0]?.type === 'file') {
        prev.forEach((a) => {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
        })
        return newItems
      }

      return [...prev, ...newItems]
    })

    return { tooLarge: false }
  }, [])

  // Keep the existing file-picker flow working.
  const stageImages = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      e.target.value = ''
      stageFiles(files)
    },
    [stageFiles],
  )

  const stageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      return
    }

    setPendingAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
      })

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

  const toggleAllHD = useCallback(() => {
    setIsAllHD((v) => !v)
  }, [])

  const dropSent = useCallback((sent: PendingAttachment[]) => {
    if (sent.length === 0) return

    const ids = new Set(sent.map((a) => a.id))

    sent.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })

    setPendingAttachments((prev) => prev.filter((a) => !ids.has(a.id)))
  }, [])

  const flushAttachments = useCallback(
    async (onSend: SendFn) => {
      const items = ref.current
      if (items.length === 0) return

      const images: string[] = []
      const imageItems: PendingAttachment[] = []

      for (const att of items) {
        if (att.type === 'file') {
          const { url, filename, size } = await chatService.uploadFile(att.file)

          await onSend(
            JSON.stringify({
              url,
              name: filename || att.file.name,
              size: Number(size) || 0,
            }),
            'file',
          )

          dropSent([att])
        } else if (att.type === 'video') {
          const { url } = await chatService.uploadFile(att.file)
          await onSend(url, 'video')
          dropSent([att])
        } else {
          const fileToUpload = isAllHD
            ? att.file
            : await compressImage(att.file, 0.7)

          const { url } = await chatService.uploadFile(fileToUpload)

          images.push(url)
          imageItems.push(att)
        }
      }

      if (images.length === 1) {
        await onSend(images[0], 'image')
      } else if (images.length > 1) {
        await onSend(JSON.stringify(images), 'image')
      }

      dropSent(imageItems)
      setIsAllHD(true)
    },
    [isAllHD, dropSent],
  )

  return {
    pendingAttachments,
    isAllHD,
    stageImages,
    stageFiles,
    stageFile,
    removeAttachment,
    toggleAllHD,
    flushAttachments,
  }
}
