'use client'

import { toast } from 'sonner'
import { chatService, FILE_TOO_LARGE } from '@/lib/api/chat'
import type { MessageType } from '@/lib/api/types'

interface Options {
  onSend: (content: string, type?: MessageType) => Promise<void> | void
  onUploadingChange: (uploading: boolean) => void
  uploadErrorLabel: string
  tooLargeLabel: string
}

/**
 * Image/video and document attachment pickers for the chat composer. Uploads to
 * GridFS via chatService then sends the resulting message (image/video/file).
 */
export function useFileAttachments({
  onSend,
  onUploadingChange,
  uploadErrorLabel,
  tooLargeLabel,
}: Options) {
  const reportUploadError = (err: unknown) => {
    const tooLarge = err instanceof Error && err.message === FILE_TOO_LARGE
    toast.error(tooLarge ? tooLargeLabel : uploadErrorLabel)
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    onUploadingChange(true)
    try {
      const images: string[] = []
      for (const file of files) {
        const { url } = await chatService.uploadFile(file)
        if (file.type.startsWith('video/')) {
          await onSend(url, 'video')
        } else {
          images.push(url)
        }
      }
      if (images.length === 1) await onSend(images[0], 'image')
      else if (images.length > 1) await onSend(JSON.stringify(images), 'image')
    } catch (err) {
      reportUploadError(err)
    } finally {
      onUploadingChange(false)
    }
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    onUploadingChange(true)
    try {
      const { url, filename, size } = await chatService.uploadFile(file)
      // The upload response returns size as a string (backend String.valueOf);
      // store it as a Number so the file size is consistent cross-platform
      // (web shows it, mobile parsers don't crash on a string).
      await onSend(
        JSON.stringify({ url, name: filename || file.name, size: Number(size) || 0 }),
        'file',
      )
    } catch (err) {
      reportUploadError(err)
    } finally {
      onUploadingChange(false)
    }
  }

  return { handleImagePick, handleFilePick }
}
