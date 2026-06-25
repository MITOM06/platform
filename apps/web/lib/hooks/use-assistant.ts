// lib/hooks/use-assistant.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchAssistant, type AssistantInfo } from '@/lib/api/assistant'

export function useAssistant() {
  return useQuery<AssistantInfo | null>({
    queryKey: ['assistant', 'me'],
    queryFn: fetchAssistant,
    staleTime: 5 * 60 * 1000, // 5 min — assistant mapping changes rarely
  })
}
