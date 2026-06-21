'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  MessageCircle, UserPlus, UserMinus, ShieldOff, ShieldAlert, Loader2,
  Cake, Phone, Users,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useUser } from '@/lib/hooks/use-user'
import { useUserStatus } from '@/lib/hooks/use-user-status'
import { useRelationship } from '@/lib/hooks/use-relationship'
import { useAuthStore } from '@/lib/store/auth.store'
import { friendsService } from '@/lib/api/friends'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'

interface Props {
  userId: string | null
  onClose: () => void
}

function getInitial(name: string): string {
  return name[0]?.toUpperCase() ?? '?'
}

function genderLabel(gender: string, t: (k: string) => string): string | null {
  switch (gender) {
    case 'male': return t('genderMale')
    case 'female': return t('genderFemale')
    case 'other': return t('genderOther')
    default: return null
  }
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}

export function UserProfileDrawer({ userId, onClose }: Props) {
  const router = useRouter()
  const t = useTranslations('chat')
  const locale = useLocale()
  const [actionLoading, setActionLoading] = useState(false)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data: user, isLoading } = useUser(userId ?? undefined)
  const { data: status } = useUserStatus(userId ?? undefined)
  const { relationship, refetch: refetchRel, block, unblock } = useRelationship(userId ?? undefined)

  const handleSendMessage = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      const conv = await chatService.createConversation(userId)
      router.push(`/conversations/${conv.id}`)
      onClose()
    } catch (err) {
      const isConflict = (err as { response?: { status?: number } })?.response?.status === 409
      if (isConflict) {
        try {
          const convs = await chatService.getConversations()
          const existing = convs.content.find((c) =>
            c.type === 'direct' && c.participants.includes(userId),
          )
          if (existing) {
            router.push(`/conversations/${existing.id}`)
            onClose()
            return
          }
        } catch { /* fall through */ }
      }
      toast.error(t('openConversationError'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleFriendAction = async () => {
    if (!userId || !relationship) return
    setActionLoading(true)
    try {
      if (relationship.friendStatus === 'accepted') {
        await friendsService.removeFriend(userId)
        toast.success(t('friendRemoved'))
      } else if (relationship.friendStatus === 'none') {
        await friendsService.sendRequest(userId)
        toast.success(t('friendRequestSent'))
      } else if (relationship.friendStatus === 'incoming') {
        await friendsService.acceptRequest(userId)
        toast.success(t('friendRequestAccepted'))
      }
      refetchRel()
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!userId || !relationship) return
    setActionLoading(true)
    try {
      if (relationship.iBlocked) {
        await unblock(userId)
        toast.success(t('userUnblocked'))
      } else {
        await block(userId)
        toast.success(t('userBlocked'))
      }
      refetchRel()
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const displayName = user?.displayName ?? t('userFallback')
  const friendLabel =
    relationship?.friendStatus === 'accepted' ? t('friendRemove')
    : relationship?.friendStatus === 'incoming' ? t('friendAccept')
    : relationship?.friendStatus === 'outgoing' ? t('friendRequested')
    : t('friendAdd')

  // The auth-service already strips dob/phone/gender server-side based on the
  // other user's per-field visibility flags — but we also gate per field
  // defensively so a viewer never sees private info even if the server returned
  // it. Each flag falls back to `!hideInfo` for legacy users without per-field
  // flags. bio is always shown.
  const isOwnProfile = !!userId && userId === currentUserId
  const showDob = isOwnProfile || (user?.showDateOfBirth ?? !user?.hideInfo)
  const showPhone = isOwnProfile || (user?.showPhoneNumber ?? !user?.hideInfo)
  const showGender = isOwnProfile || (user?.showGender ?? !user?.hideInfo)
  const dobText = showDob && user?.dateOfBirth
    ? new Date(user.dateOfBirth).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const phoneText = showPhone && user?.phoneNumber ? user.phoneNumber : null
  const genderText = showGender && user?.gender ? genderLabel(user.gender, t) : null

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{t('profileTitle')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-4 px-6 pb-6">
            {/* Cover photo backdrop (view-only — no edit affordance for other users) */}
            <div className="relative -mx-6 -mt-4 h-24 overflow-hidden">
              {user?.coverPhoto ? (
                <Image
                  src={absoluteMediaUrl(user.coverPhoto)}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink opacity-60" />
              )}
            </div>

            {/* Avatar + name + status */}
            <div className="flex flex-col items-center gap-2 -mt-10">
              <div className="relative">
                <Avatar className="size-20 ring-4 ring-background">
                  {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={displayName} />}
                  <AvatarFallback className="text-2xl font-semibold">
                    {getInitial(displayName)}
                  </AvatarFallback>
                </Avatar>
                {status?.online && (
                  <span className="absolute bottom-1 right-1 size-3.5 rounded-full bg-[#00E676] border-2 border-background shadow-[0_0_6px_rgba(0,230,118,0.6)]" />
                )}
              </div>
              <p className="font-semibold text-base">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {status?.online ? t('online') : t('offline')}
              </p>
              {user?.bio && (
                <p className="text-sm text-center text-muted-foreground max-w-[220px] leading-snug">
                  {user.bio}
                </p>
              )}
            </div>

            {/* Profile info — each field gated independently by its show flag */}
            {(dobText || phoneText || genderText) && (
              <>
                <Separator />
                <div className="flex flex-col gap-2 px-1">
                  {dobText && <InfoRow icon={<Cake className="size-4" />} value={dobText} />}
                  {phoneText && <InfoRow icon={<Phone className="size-4" />} value={phoneText} />}
                  {genderText && <InfoRow icon={<Users className="size-4" />} value={genderText} />}
                </div>
              </>
            )}

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-col gap-2 px-1">
              <Button
                className="w-full justify-start gap-2"
                onClick={handleSendMessage}
                disabled={actionLoading}
              >
                <MessageCircle className="size-4" />
                {t('sendMessageAction')}
              </Button>

              {relationship && !relationship.blockedMe && (
                <Button
                  variant="outline"
                  className={[
                    'w-full justify-start gap-2',
                    relationship.friendStatus === 'accepted'
                      ? 'text-destructive hover:text-destructive'
                      : '',
                  ].join(' ')}
                  onClick={handleFriendAction}
                  disabled={actionLoading || relationship.friendStatus === 'outgoing'}
                >
                  {relationship.friendStatus === 'accepted' ? (
                    <UserMinus className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  {friendLabel}
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                onClick={handleBlock}
                disabled={actionLoading}
              >
                {relationship?.iBlocked ? (
                  <>
                    <ShieldOff className="size-4" />
                    {t('unblockAction')}
                  </>
                ) : (
                  <>
                    <ShieldAlert className="size-4" />
                    {t('blockAction')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
