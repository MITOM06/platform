'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { UserMinus, UserPlus, Pencil, Check, X, ImageIcon, LogOut, Camera, FolderOpen, Images, Bot } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import type { Conversation, UserSearchResult } from '@/lib/api/types'
import { useRouter } from 'next/navigation'

const WALLPAPER_PRESETS = [
  { id: 'default', label: 'Mặc định', bg: 'bg-background border border-muted' },
  { id: 'sunset', label: 'Sunset', bg: 'bg-gradient-to-br from-orange-400 to-purple-600' },
  { id: 'midnight', label: 'Midnight', bg: 'bg-gradient-to-br from-indigo-900 to-slate-900' },
  { id: 'sweet_pink', label: 'Sweet Pink', bg: 'bg-gradient-to-br from-pink-300 to-red-400' },
  { id: 'neon_teal', label: 'Neon Teal', bg: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
  { id: 'dark_shadow', label: 'Dark Shadow', bg: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
]

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
}

export function GroupSettingsDrawer({ conversation, currentUserId, open, onClose }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(conversation.name ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [saving, setSaving] = useState(false)
  const isAdmin = conversation.admins.includes(currentUserId)
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`wallpaper-${conversation.id}`) || 'default'
    }
    return 'default'
  })

  const handleSelectWallpaper = (presetId: string) => {
    setSelectedWallpaper(presetId)
    localStorage.setItem(`wallpaper-${conversation.id}`, presetId)
    window.dispatchEvent(new Event('wallpaper-changed'))
  }

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

  const handleLeaveGroup = async () => {
    if (!confirm('Bạn có chắc muốn rời nhóm không?')) return
    setSaving(true)
    try {
      await chatService.removeMember(conversation.id, currentUserId)
      invalidate()
      onClose()
      router.push('/')
      toast.success('Đã rời nhóm')
    } catch {
      toast.error('Không thể rời nhóm')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const uploaded = await chatService.uploadFile(file)
      await chatService.updateGroup(conversation.id, undefined, uploaded.url)
      invalidate()
      toast.success('Đã cập nhật ảnh nhóm')
    } catch {
      toast.error('Không thể cập nhật ảnh')
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

          {/* Group header & avatar */}
          <div className="flex flex-col items-center py-4 space-y-3">
            <div className="relative group">
              <Avatar className="size-20">
                {conversation.avatarUrl ? (
                  <img src={conversation.avatarUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-pon-cyan to-pon-peach text-white">
                    {(conversation.name ?? 'Group')[0]?.toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              {isAdmin && (
                <label className="absolute bottom-0 right-0 p-1.5 bg-pon-cyan text-black rounded-full cursor-pointer shadow-sm hover:scale-110 transition-transform">
                  <Camera className="size-3.5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={saving} />
                </label>
              )}
            </div>

            {editingName ? (
              <div className="flex gap-2 w-full max-w-[200px]">
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
                <span className="font-semibold text-lg">{conversation.name ?? 'Nhóm không tên'}</span>
                {isAdmin && (
                  <Button size="icon-xs" variant="ghost" onClick={() => setEditingName(true)}>
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{conversation.participants.length} thành viên</p>
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

          <Separator />

          {/* Wallpaper Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4" />
              Hình nền cuộc trò chuyện
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectWallpaper(preset.id)}
                  className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 hover:opacity-95 transition-all text-[10px] font-medium ${
                    selectedWallpaper === preset.id
                      ? 'border-primary shadow-sm bg-primary/5'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`w-full aspect-square rounded-md ${preset.bg}`} />
                  <span className="truncate max-w-full text-foreground/80">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Links */}
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm font-normal"
              onClick={() => { onClose(); router.push(`/shared-media/${conversation.id}`) }}
            >
              <Images className="size-4 mr-3 text-pon-cyan" />
              Ảnh & Media chia sẻ
            </Button>
            
            <Button
              variant="ghost"
              className="w-full justify-start text-sm font-normal"
              onClick={() => { onClose(); router.push(`/kb/${conversation.id}`) }}
            >
              <FolderOpen className="size-4 mr-3 text-pon-peach" />
              Tài liệu Knowledge Base
            </Button>

            {isAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start text-sm font-normal"
                onClick={() => { onClose(); router.push(`/ai-persona?conversationId=${conversation.id}`) }}
              >
                <Bot className="size-4 mr-3 text-[#B47FFF]" />
                Cài đặt AI Persona
              </Button>
            )}
          </div>

          <Separator />

          {/* Leave Group */}
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLeaveGroup}
            disabled={saving}
          >
            <LogOut className="size-4 mr-3" />
            Rời nhóm
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
