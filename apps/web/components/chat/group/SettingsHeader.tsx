'use client'

import { useTranslations } from 'next-intl'
import { Sparkles, User, BellOff, Bell, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'

const ACTION_CLS = 'flex flex-col items-center gap-1.5 w-16'
const ICON_WRAP = 'size-10 rounded-full bg-pon-cyan/10 text-pon-cyan flex items-center justify-center'
const LABEL_CLS = 'text-[11px] text-muted-foreground truncate w-full text-center'

/** epoch ms value chat-service uses for "muted forever" */
const MUTE_FOREVER_MS = 9_200_000_000_000_000

function formatMuteExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return ''
  const mins = Math.ceil(remaining / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(remaining / 3_600_000)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

interface Props {
  displayName: string
  avatarUrl?: string
  avatarLetter: string
  isDirect: boolean
  isAI: boolean
  isMuted: boolean
  muteExpiresAt?: number | null
  saving: boolean
  onOpenProfile?: () => void
  onMuteToggle: () => void
  onSearch?: () => void
}

/** Avatar + name + quick-action row at the top of the settings drawer. */
export function SettingsHeader({
  displayName,
  avatarUrl,
  avatarLetter,
  isDirect,
  isAI,
  isMuted,
  muteExpiresAt,
  saving,
  onOpenProfile,
  onMuteToggle,
  onSearch,
}: Props) {
  const t = useTranslations('chat')

  const showMuteExpiry =
    isMuted &&
    typeof muteExpiresAt === 'number' &&
    muteExpiresAt < MUTE_FOREVER_MS

  const muteExpiryLabel = showMuteExpiry ? ` (${formatMuteExpiry(muteExpiresAt!)})` : ''

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <Avatar className="size-24 border-2 border-border/50">
          {avatarUrl && <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt={displayName} />}
          <AvatarFallback className="text-3xl font-medium bg-gradient-to-br from-pon-cyan/80 to-pon-peach/80 text-white">
            {avatarLetter}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="text-xl font-bold line-clamp-2 px-4">{displayName}</h2>
          {isAI && (
            <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-pon-cyan">
              <Sparkles className="size-3" />
              <span>{t('aiAssistant')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-evenly px-2">
        {isDirect && !isAI && onOpenProfile && (
          <button onClick={onOpenProfile} className={ACTION_CLS}>
            <div className={ICON_WRAP}><User className="size-5" /></div>
            <span className={LABEL_CLS}>{t('viewProfile')}</span>
          </button>
        )}
        <button onClick={onMuteToggle} disabled={saving} className={ACTION_CLS}>
          <div className={ICON_WRAP}>
            {isMuted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
          </div>
          <span className={LABEL_CLS}>
            {isMuted
              ? `${t('unmuteNotifications')}${muteExpiryLabel}`
              : t('muteNotifications')}
          </span>
        </button>
        <button onClick={onSearch} className={ACTION_CLS}>
          <div className={ICON_WRAP}><Search className="size-5" /></div>
          <span className={LABEL_CLS}>{t('searchMessages')}</span>
        </button>
      </div>
    </>
  )
}
