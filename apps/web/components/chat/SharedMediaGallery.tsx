'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, ImageIcon, FileText, Link as LinkIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl, parseFileMeta, firstUrl } from '@/lib/media'

/** Best-effort display label for a file/link row (last path segment or the URL). */
function rowLabel(content: string, type: string): { label: string; href: string } {
  if (type === 'file') {
    const meta = parseFileMeta(content)
    return { label: meta.name, href: absoluteMediaUrl(meta.url) }
  }
  // link tab — content may be plain text containing a URL
  const url = firstUrl(content) ?? content
  return { label: url, href: url }
}

interface Props {
  conversationId: string
  open: boolean
  onClose: () => void
}

function GalleryTab({ conversationId, type }: { conversationId: string; type: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['attachments', conversationId, type],
    queryFn: () => chatService.getAttachments(conversationId, type),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.content.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">Chưa có nội dung</p>
    )
  }

  if (type === 'media') {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {data.content.map((msg) => {
          const src = absoluteMediaUrl(msg.content || '')
          return (
            <a
              key={msg.id}
              href={src || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center"
            >
              {msg.type === 'image' && src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Broken asset → fall back to a placeholder icon.
                    const el = e.currentTarget
                    el.style.display = 'none'
                    el.parentElement?.classList.add('media-broken')
                  }}
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
              <ImageIcon className="size-6 text-muted-foreground hidden [.media-broken_&]:block" />
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.content.map((msg) => {
        if (!msg.content) return null
        const { label, href } = rowLabel(msg.content, type)
        return (
          <a
            key={msg.id}
            href={href || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
          >
            {type === 'file' ? (
              <FileText className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <LinkIcon className="size-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm truncate text-primary hover:underline">{label}</span>
          </a>
        )
      })}
    </div>
  )
}

export function SharedMediaGallery({ conversationId, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nội dung đã chia sẻ</DialogTitle>
        </DialogHeader>
          <DialogA11yDescription />

        <Tabs defaultValue="media">
          <TabsList className="w-full">
            <TabsTrigger value="media" className="flex-1">
              <ImageIcon className="size-4" />
              Ảnh/Video
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <FileText className="size-4" />
              Tệp
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              <LinkIcon className="size-4" />
              Liên kết
            </TabsTrigger>
          </TabsList>
          <div className="mt-3 max-h-80 overflow-y-auto">
            <TabsContent value="media">
              <GalleryTab conversationId={conversationId} type="media" />
            </TabsContent>
            <TabsContent value="file">
              <GalleryTab conversationId={conversationId} type="file" />
            </TabsContent>
            <TabsContent value="link">
              <GalleryTab conversationId={conversationId} type="link" />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
