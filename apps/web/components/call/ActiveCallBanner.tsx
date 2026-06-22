'use client'

import { useTranslations } from 'next-intl'
import { Phone, Video } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import type { CallMedia } from '@/lib/api/types'

interface Props {
  callId: string
  conversationId: string
  media: CallMedia
  aiNotetaker: boolean
  joinedCount: number
}

/**
 * Sticky banner shown in the conversation thread while a group call is active
 * (Track A §4: "Group call · N joined · Join"). Clicking Join joins the mesh.
 * Hidden once the local user is already in this call.
 */
export function ActiveCallBanner({ callId, conversationId, media, aiNotetaker, joinedCount }: Props) {
  const t = useTranslations('call')
  const groupCallId = useCallStore((s) => s.groupCallId)
  const currentUser = useAuthStore((s) => s.user)

  // Already in this call → no banner.
  if (groupCallId === callId) return null

  const join = () => {
    const userId = currentUser?.id
    if (!userId) return
    void import('@/lib/webrtc/group-call-manager').then((m) =>
      m.groupCallManager.join(callId, conversationId, userId, media, aiNotetaker),
    )
  }

  return (
    <div className="flex items-center gap-3 border-b bg-pon-cyan/10 px-4 py-2 text-sm">
      {media === 'video' ? (
        <Video className="size-4 text-pon-cyan shrink-0" />
      ) : (
        <Phone className="size-4 text-pon-cyan shrink-0" />
      )}
      <span className="flex-1 truncate font-medium">
        {t('activeCallBanner', { count: joinedCount })}
      </span>
      <Button size="sm" className="h-7 gap-1.5" onClick={join}>
        {t('join')}
      </Button>
    </div>
  )
}
