import { CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/lib/hooks/use-user'
import { absoluteMediaUrl } from '@/lib/media'
import type { Message } from '@/lib/api/types'

function ReadUserTile({ userId }: { userId: string }) {
  const t = useTranslations('chat')
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
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0">
          {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={name} />}
          <AvatarFallback className="text-sm">{(name[0] ?? '?').toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCheck className="size-4 text-primary" />
        <span>{t('seenStatus')}</span>
      </div>
    </div>
  )
}

interface Props {
  message: Message
  open: boolean
  onClose: () => void
}

export function GroupReadDetailsModal({ message, open, onClose }: Props) {
  const t = useTranslations('chat')
  const readBy = message.readBy || []

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('readDetails')}
      desktopClassName="sm:max-w-[400px]"
    >
      <div className="max-h-[60dvh] overflow-y-auto">
        {readBy.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('noReadsYet')}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {readBy.map((uid) => (
              <ReadUserTile key={uid} userId={uid} />
            ))}
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
