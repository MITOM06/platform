'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Loader2, X, Users, MessageCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import type { UserSearchResult } from '@/lib/api/types'

interface Props {
  open: boolean
  onClose: () => void
}

function getUserId(user: UserSearchResult): string {
  return user._id ?? user.id ?? ''
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function UserRow({
  user,
  selected,
  loading,
  onSelect,
}: {
  user: UserSearchResult
  selected?: boolean
  loading?: boolean
  onSelect: () => void
}) {
  const uid = getUserId(user)
  return (
    <button
      key={uid}
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="text-xs font-medium">{getInitials(user.displayName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />}
      {selected && !loading && (
        <div className="size-4 rounded-full bg-primary flex items-center justify-center shrink-0">
          <X className="size-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  )
}

export function NewConversationModal({ open, onClose }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [creatingId, setCreatingId] = useState<string | null>(null)

  // Group state
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) return
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await authService.searchUsers(query.trim())
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const handleClose = () => {
    setQuery('')
    setResults([])
    setGroupName('')
    setSelectedMembers([])
    onClose()
  }

  // Direct conversation
  const handleSelectDirect = async (user: UserSearchResult) => {
    const userId = getUserId(user)
    if (!userId || creatingId) return
    setCreatingId(userId)
    try {
      const conv = await chatService.createConversation(userId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(`/conversations/${conv.id}`)
      handleClose()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const body = err.response.data as { conversationId?: string }
        if (body.conversationId) {
          router.push(`/conversations/${body.conversationId}`)
          handleClose()
          return
        }
      }
      toast.error('Không thể tạo cuộc trò chuyện')
    } finally {
      setCreatingId(null)
    }
  }

  // Group toggle member selection
  const toggleMember = (user: UserSearchResult) => {
    const uid = getUserId(user)
    setSelectedMembers((prev) =>
      prev.some((u) => getUserId(u) === uid)
        ? prev.filter((u) => getUserId(u) !== uid)
        : [...prev, user],
    )
  }

  // Create group
  const handleCreateGroup = async () => {
    if (selectedMembers.length < 1 || !groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên')
      return
    }
    setCreatingGroup(true)
    try {
      const memberIds = selectedMembers.map(getUserId).filter(Boolean)
      const conv = await chatService.createGroup(groupName.trim(), memberIds)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(`/conversations/${conv.id}`)
      handleClose()
      toast.success('Đã tạo nhóm')
    } catch {
      toast.error('Không thể tạo nhóm')
    } finally {
      setCreatingGroup(false)
    }
  }

  const SearchSection = (
    <>
      <div className="relative mt-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên hoặc email..."
          value={query}
          onChange={(e) => {
            const val = e.target.value
            setQuery(val)
            if (!val.trim()) {
              setResults([])
            }
          }}
          className="pl-8"
          autoFocus
        />
      </div>
      <div className="mt-2 min-h-16 max-h-64 overflow-y-auto">
        {isSearching && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isSearching && query.trim() && results.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">Không tìm thấy người dùng</p>
        )}
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cuộc trò chuyện mới</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="direct">
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">
              <MessageCircle className="size-4" />
              Trực tiếp
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              <Users className="size-4" />
              Nhóm
            </TabsTrigger>
          </TabsList>

          {/* ── Direct tab ── */}
          <TabsContent value="direct">
            {SearchSection}
            {!isSearching && results.map((user) => {
              const uid = getUserId(user)
              return (
                <UserRow
                  key={uid}
                  user={user}
                  loading={creatingId === uid}
                  onSelect={() => handleSelectDirect(user)}
                />
              )
            })}
          </TabsContent>

          {/* ── Group tab ── */}
          <TabsContent value="group" className="space-y-3">
            <Input
              placeholder="Tên nhóm..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((u) => (
                  <span
                    key={getUserId(u)}
                    className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs"
                  >
                    {u.displayName}
                    <button onClick={() => toggleMember(u)}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {SearchSection}
            {!isSearching && results.map((user) => {
              const uid = getUserId(user)
              const isSelected = selectedMembers.some((u) => getUserId(u) === uid)
              return (
                <UserRow
                  key={uid}
                  user={user}
                  selected={isSelected}
                  onSelect={() => toggleMember(user)}
                />
              )
            })}

            <Button
              onClick={handleCreateGroup}
              disabled={creatingGroup || selectedMembers.length < 1 || !groupName.trim()}
              className="w-full"
            >
              {creatingGroup ? <Loader2 className="size-4 animate-spin" /> : 'Tạo nhóm'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
