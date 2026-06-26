'use client'

import { useTranslations } from 'next-intl'
import { PhoneOff, Phone, Video, Sparkles } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { useCallNames } from '@/lib/hooks/use-call-names'
import { Button } from '@/components/ui/button'

/**
 * Incoming group-call ring prompt (Track A §3, `type:'call-ring'`). Accept →
 * join the call via the group manager; Decline → just clear the ring.
 */
export function IncomingGroupCall() {
  const t = useTranslations('call')
  const incoming = useCallStore((s) => s.incomingGroupCall)
  const currentUser = useAuthStore((s) => s.user)
  // Resolve the starter's userId → display name (the broadcast carries the raw id).
  const resolveName = useCallNames(
    incoming?.conversationId,
    incoming ? [incoming.startedBy] : [],
  )

  if (!incoming) return null

  const accept = () => {
    const userId = currentUser?.id
    useCallStore.getState().setIncomingGroupCall(null)
    if (!userId) return
    void import('@/lib/webrtc/group-call-manager').then((m) =>
      m.groupCallManager.join(
        incoming.callId,
        incoming.conversationId,
        userId,
        incoming.media,
        incoming.aiNotetaker,
      ),
    )
  }

  const decline = () => useCallStore.getState().setIncomingGroupCall(null)

  return (
    <div className="fixed bottom-6 right-6 z-[110] w-[min(90vw,320px)] sm:w-80 rounded-2xl border bg-background p-5 shadow-2xl">
      <p className="text-sm text-muted-foreground">
        {incoming.media === 'video' ? t('incomingGroupVideo') : t('incomingGroupVoice')}
      </p>
      <p className="mt-1 text-lg font-semibold truncate">
        {resolveName(incoming.startedBy) || t('peerFallback')}
      </p>
      {incoming.aiNotetaker && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-pon-cyan">
          <Sparkles className="size-3.5" />
          {t('aiTakingNotes')}
        </p>
      )}
      <div className="mt-5 flex justify-between gap-3">
        <Button variant="destructive" className="flex-1 gap-2" onClick={decline}>
          <PhoneOff className="size-4" /> {t('decline')}
        </Button>
        <Button className="flex-1 gap-2 bg-[#00C853] hover:bg-[#00B248]" onClick={accept}>
          {incoming.media === 'video' ? <Video className="size-4" /> : <Phone className="size-4" />}{' '}
          {t('join')}
        </Button>
      </div>
    </div>
  )
}
