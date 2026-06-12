'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle, UserPlus, UserMinus, ShieldOff, ShieldAlert, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useUser } from '@/lib/hooks/use-user'
import { useUserStatus } from '@/lib/hooks/use-user-status'
import { useRelationship } from '@/lib/hooks/use-relationship'
import { friendsService } from '@/lib/api/friends'
import { chatService } from '@/lib/api/chat'

interface Props {
  userId: string | null
  onClose: () => void
}

function getInitial(name: string): string {
  return name[0]?.toUpperCase() ?? '?'
}

export function UserProfileDrawer({ userId, onClose }: Props) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState(false)

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
      toast.error('Không thể mở cuộc trò chuyện')
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
        toast.success('Đã xoá bạn bè')
      } else if (relationship.friendStatus === 'none') {
        await friendsService.sendRequest(userId)
        toast.success('Đã gửi lời mời kết bạn')
      } else if (relationship.friendStatus === 'incoming') {
        await friendsService.acceptRequest(userId)
        toast.success('Đã chấp nhận lời mời kết bạn')
      }
      refetchRel()
    } catch {
      toast.error('Thao tác thất bại')
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
        toast.success('Đã bỏ chặn')
      } else {
        await block(userId)
        toast.success('Đã chặn người dùng')
      }
      refetchRel()
    } catch {
      toast.error('Thao tác thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const displayName = user?.displayName ?? 'Người dùng'
  const friendLabel =
    relationship?.friendStatus === 'accepted' ? 'Xoá bạn bè'
    : relationship?.friendStatus === 'incoming' ? 'Chấp nhận kết bạn'
    : relationship?.friendStatus === 'outgoing' ? 'Đã gửi lời mời'
    : 'Kết bạn'

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-72 sm:w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Hồ sơ</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Avatar + name + status */}
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="relative">
                <Avatar className="size-20">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
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
                {status?.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </p>
              {(user as { bio?: string })?.bio && (
                <p className="text-sm text-center text-muted-foreground max-w-[200px] leading-snug">
                  {(user as { bio?: string }).bio}
                </p>
              )}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-col gap-2 px-1">
              <Button
                className="w-full justify-start gap-2"
                onClick={handleSendMessage}
                disabled={actionLoading}
              >
                <MessageCircle className="size-4" />
                Nhắn tin
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
                    Bỏ chặn
                  </>
                ) : (
                  <>
                    <ShieldAlert className="size-4" />
                    Chặn người dùng
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
