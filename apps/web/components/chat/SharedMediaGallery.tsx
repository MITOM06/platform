'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, ImageIcon, FileText, Link as LinkIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { chatService } from '@/lib/api/chat'

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
        {data.content.map((msg) => (
          <div
            key={msg.id}
            className="aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center"
          >
            {msg.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.content} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.content.map((msg) => (
        <div key={msg.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
          {type === 'file' ? (
            <FileText className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <LinkIcon className="size-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm truncate">{msg.content}</span>
        </div>
      ))}
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
