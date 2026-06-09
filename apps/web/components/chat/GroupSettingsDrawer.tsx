'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { UserMinus, UserPlus, Pencil, Check, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import type { Conversation, UserSearchResult } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
}

export function GroupSettingsDrawer({ conversation, currentUserId, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(conversation.name ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [saving, setSaving] = useState(false)
  const isAdmin = conversation.admins.includes(currentUserId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
  }

  const handleSaveName = async () => {
    if (!nameValue.trim()) return
    setSaving(true)
    try {
      await chatService.updateGroup(conversation.id, nameValue.trim())
      invalidate()
      setEditingName(false)
      toast.success('Đã cập nhật tên nhóm')
    } catch {
      toast.error('Không thể cập nhật tên')
    } finally {
      setSaving(false)
    }
  }

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const results = await authService.searchUsers(q.trim())
      setSearchResults(results.filter((u) => {
        const uid = u._id ?? u.id ?? ''
        return !conversation.participants.includes(uid)
      }))
    } catch {
      setSearchResults([])
    }
  }

  const handleAddMember = async (user: UserSearchResult) => {
    const uid = user._id ?? user.id ?? ''
    if (!uid) return
    setSaving(true)
    try {
      await chatService.addMembers(conversation.id, [uid])
      invalidate()
      setSearchQuery('')
      setSearchResults([])
      toast.success(`Đã thêm ${user.displayName}`)
    } catch {
      toast.error('Không thể thêm thành viên')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setSaving(true)
    try {
      await chatService.removeMember(conversation.id, userId)
      invalidate()
      toast.success('Đã xóa thành viên')
    } catch {
      toast.error('Không thể xóa thành viên')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cài đặt nhóm</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <Separator />

          {/* Group name */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tên nhóm
            </p>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="icon-sm" onClick={handleSaveName} disabled={saving}>
                  <Check className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => setEditingName(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm flex-1">{conversation.name ?? 'Nhóm không tên'}</span>
                {isAdmin && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Members */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Thành viên ({conversation.participants.length})
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {conversation.participants.map((uid) => (
                <div key={uid} className="flex items-center gap-2 py-1">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-xs">{uid[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 truncate">{uid}</span>
                  {isAdmin && uid !== currentUserId && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleRemoveMember(uid)}
                      disabled={saving}
                    >
                      <UserMinus className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add members */}
          {isAdmin && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <UserPlus className="size-3.5" /> Thêm thành viên
              </p>
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder="Tìm người dùng..."
                className="h-8 text-sm"
              />
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {searchResults.map((user) => {
                  const uid = user._id ?? user.id ?? ''
                  return (
                    <button
                      key={uid}
                      onClick={() => handleAddMember(user)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left"
                    >
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-xs">
                          {user.displayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{user.displayName}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
