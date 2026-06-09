'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ConversationItem } from './ConversationItem'
import { useConversations } from '@/lib/hooks/use-conversations'

export function ConversationList() {
  const [search, setSearch] = useState('')
  const { data: conversations, isLoading, isError } = useConversations()

  const filtered = conversations?.filter((conv) => {
    if (!search) return true
    const name = conv.name ?? ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Đang tải...
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-8 text-sm text-destructive">
            Không thể tải danh sách
          </div>
        )}

        {!isLoading && !isError && filtered?.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {search ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện'}
          </div>
        )}

        {filtered?.map((conv) => (
          <ConversationItem key={conv.id} conversation={conv} />
        ))}
      </div>
    </div>
  )
}
