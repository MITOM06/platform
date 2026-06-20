'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Loader2, X, Users, MessageCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import axios from 'axios'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import { useDepartments } from '@/lib/hooks/use-admin'
import type { UserSearchResult } from '@/lib/api/types'

const NO_DEPT = '__none__'

interface Props {
  open: boolean
  onClose: () => void
  defaultTab?: 'direct' | 'group'
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

export function NewConversationModal({ open, onClose, defaultTab }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations('chat')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [creatingId, setCreatingId] = useState<string | null>(null)

  // Group state
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>(defaultTab || 'direct')

  // Department group (P6) — only members who can manage departments may create one.
  const canDepts = useHasCapability('MANAGE_DEPARTMENTS')
  const { data: departments = [] } = useDepartments(canDepts)
  const [departmentId, setDepartmentId] = useState<string>(NO_DEPT)

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
    setDepartmentId(NO_DEPT)
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
      toast.error(t('newConvDirectError'))
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
      toast.error(t('newConvGroupValidation'))
      return
    }
    setCreatingGroup(true)
    try {
      const memberIds = selectedMembers.map(getUserId).filter(Boolean)
      const conv = await chatService.createGroup(
        groupName.trim(),
        memberIds,
        false,
        departmentId === NO_DEPT ? undefined : departmentId,
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(`/conversations/${conv.id}`)
      handleClose()
      toast.success(t('newConvGroupSuccess'))
    } catch {
      toast.error(t('newConvGroupError'))
    } finally {
      setCreatingGroup(false)
    }
  }

  const SearchSection = (
    <>
      <div className="relative mt-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t('newConvSearchPlaceholder')}
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
          <p className="text-center text-sm text-muted-foreground py-6">{t('newConvNoUsers')}</p>
        )}
      </div>
    </>
  )

  return (
    <Dialog key={`${open}-${defaultTab}`} open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newConvTitle')}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'direct' | 'group')}>
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">
              <MessageCircle className="size-4" />
              {t('newConvTabDirect')}
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              <Users className="size-4" />
              {t('newConvTabGroup')}
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
              placeholder={t('newConvGroupNamePlaceholder')}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Department group (P6) — admins can scope the group + bot to a department */}
            {canDepts && departments.length > 0 && (
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('newConvDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPT}>{t('newConvNoDepartment')}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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
              {creatingGroup ? <Loader2 className="size-4 animate-spin" /> : t('newConvCreateGroup')}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
