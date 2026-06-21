import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/lib/hooks/use-user'
import { absoluteMediaUrl } from '@/lib/media'
import type { Message } from '@/lib/api/types'

function ReactorTile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUser(userId)
  const name = user?.displayName ?? '…'

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-2 px-1">
        <div className="size-10 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="h-4 bg-muted animate-pulse rounded w-24" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <Avatar className="size-10 shrink-0">
        {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={name} />}
        <AvatarFallback className="text-sm">{(name[0] ?? '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{name}</span>
    </div>
  )
}

interface Props {
  message: Message
  open: boolean
  onClose: () => void
}

export function ReactionsDetailModal({ message, open, onClose }: Props) {
  const t = useTranslations('chat')
  
  if (!message.reactions || message.reactions.length === 0) {
    return null
  }

  const reactorsByEmoji = new Map<string, string[]>()
  for (const r of message.reactions) {
    const list = reactorsByEmoji.get(r.emoji) ?? []
    list.push(r.userId)
    reactorsByEmoji.set(r.emoji, list)
  }
  
  const emojis = Array.from(reactorsByEmoji.keys())

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('reactionsDetail')}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Tabs defaultValue={emojis[0]} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent h-auto p-0 pb-1">
              {emojis.map((emoji) => (
                <TabsTrigger 
                  key={emoji} 
                  value={emoji}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-pon-cyan data-[state=active]:border-b-2 data-[state=active]:border-pon-cyan rounded-none px-4 py-2"
                >
                  <span className="text-lg leading-none mr-2">{emoji}</span>
                  <span className="text-sm">{reactorsByEmoji.get(emoji)?.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="max-h-[50vh] overflow-y-auto mt-4 px-1">
              {emojis.map((emoji) => (
                <TabsContent key={emoji} value={emoji} className="mt-0 outline-none">
                  <div className="flex flex-col gap-1">
                    {reactorsByEmoji.get(emoji)?.map((uid) => (
                      <ReactorTile key={uid} userId={uid} />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
