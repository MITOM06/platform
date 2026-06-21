'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Image as ImageIcon, FileText, Link as LinkIcon, Download } from 'lucide-react'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl, downloadMediaUrl, parseImageUrls, parseFileMeta, formatBytes } from '@/lib/media'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SharedMediaPage() {
  const t = useTranslations('sharedMedia')
  const params = useParams()
  const conversationId = params?.conversationId as string
  const [tab, setTab] = useState<'media' | 'file' | 'link'>('media')

  const { data: response, isLoading } = useQuery({
    queryKey: ['attachments', conversationId, tab],
    queryFn: () => chatService.getAttachments(conversationId, tab, 0),
    enabled: !!conversationId,
  })

  const messages = response?.content || []

  // Extract all images across all media messages
  const images = messages.flatMap((msg) => {
    if (msg.type === 'image') return parseImageUrls(msg.content)
    return []
  })

  const emptyLabel =
    tab === 'media' ? t('emptyMedia') : tab === 'file' ? t('emptyFiles') : t('emptyLinks')

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 flex items-center px-4 border-b shrink-0 gap-3">
        <Link href={`/conversations/${conversationId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'media' | 'file' | 'link')}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 py-3 border-b shrink-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="media" className="text-xs">
              <ImageIcon className="size-3.5 mr-2" />
              {t('tabMedia')}
            </TabsTrigger>
            <TabsTrigger value="file" className="text-xs">
              <FileText className="size-3.5 mr-2" />
              {t('tabFiles')}
            </TabsTrigger>
            <TabsTrigger value="link" className="text-xs">
              <LinkIcon className="size-3.5 mr-2" />
              {t('tabLinks')}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center">
                {tab === 'media' && <ImageIcon className="size-8 text-muted-foreground/50" />}
                {tab === 'file' && <FileText className="size-8 text-muted-foreground/50" />}
                {tab === 'link' && <LinkIcon className="size-8 text-muted-foreground/50" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="media" className="mt-0 outline-none">
                <div className="grid grid-cols-3 gap-1">
                  {images.map((url, i) => (
                    <a
                      key={i}
                      href={absoluteMediaUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square bg-muted relative group overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={absoluteMediaUrl(url)}
                        alt={t('imageAlt')}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </a>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="file" className="mt-0 outline-none space-y-2">
                {messages.map((msg) => {
                  const meta = parseFileMeta(msg.content)
                  const url = meta.url ?? absoluteMediaUrl(msg.content)
                  return (
                    <a
                      key={msg.id}
                      href={downloadMediaUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                    >
                      <div className="size-10 rounded-lg bg-pon-cyan/10 flex items-center justify-center shrink-0">
                        <FileText className="size-5 text-pon-cyan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{meta.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(meta.size)}</p>
                      </div>
                      <Download className="size-4 text-muted-foreground shrink-0" />
                    </a>
                  )
                })}
              </TabsContent>

              <TabsContent value="link" className="mt-0 outline-none space-y-2">
                {messages.map((msg) => (
                  <a
                    key={msg.id}
                    href={msg.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div className="size-10 rounded-lg bg-pon-peach/10 flex items-center justify-center shrink-0">
                      <LinkIcon className="size-5 text-pon-peach" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-foreground break-all line-clamp-2">
                        {msg.content}
                      </p>
                    </div>
                  </a>
                ))}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  )
}
