'use client'

import { useState, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import type { Message } from '@/lib/api/types'

interface Props {
  conversationId: string
  onClose: () => void
  onSelectMessage?: (messageId: string) => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageSearchPanel({ conversationId, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await chatService.searchMessages(conversationId, value.trim())
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  return (
    <div className="border-b bg-background px-3 py-2 flex flex-col gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Tìm trong cuộc trò chuyện..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {(loading || results.length > 0) && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {loading && (
            <div className="flex justify-center py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.map((msg) => (
            <div
              key={msg.id}
              className="px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer"
            >
              <p className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</p>
              <p className="text-sm truncate">{msg.content}</p>
            </div>
          ))}
          {!loading && query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Không tìm thấy</p>
          )}
        </div>
      )}
    </div>
  )
}
