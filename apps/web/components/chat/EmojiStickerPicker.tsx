'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😮',
  '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥', '❤️', '💔',
  '🎉', '✨', '⭐', '💯', '😴', '🤗', '🥳', '😅', '😇', '🤩',
  '😋', '😜', '🤪', '😬', '🙄', '😏', '🙂', '🥰', '😤', '👌',
]

const STICKERS = [
  '😊', '😂', '🥰', '😎', '🤔', '😭',
  '🎉', '❤️', '🔥', '👍', '🙏', '💯',
  '🥲', '😴', '😡', '🤗',
]

interface Props {
  disabled?: boolean
  onInsertEmoji: (emoji: string) => void
  onSendSticker: (sticker: string) => void
}

export function EmojiStickerPicker({ disabled, onInsertEmoji, onSendSticker }: Props) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" disabled={disabled}>
          <Smile className="size-5 text-pon-cyan" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] max-w-[calc(100vw-1rem)] p-0" align="end" side="top">
        <Tabs defaultValue="emoji" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border bg-transparent h-10 p-0">
            <TabsTrigger
              value="emoji"
              className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-pon-cyan text-xs"
            >
              {t('emojiTab')}
            </TabsTrigger>
            <TabsTrigger
              value="sticker"
              className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-pon-cyan text-xs"
            >
              {t('stickerTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emoji" className="p-2 m-0 h-48 overflow-y-auto">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onInsertEmoji(emoji)}
                  className="hover:bg-muted p-1.5 rounded text-lg flex items-center justify-center transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sticker" className="p-2 m-0 h-48 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {STICKERS.map((sticker) => (
                <button
                  key={sticker}
                  onClick={() => {
                    onSendSticker(sticker)
                    setOpen(false)
                  }}
                  className="hover:bg-pon-cyan/10 p-2 rounded-xl text-4xl flex items-center justify-center transition-colors hover:scale-105"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
