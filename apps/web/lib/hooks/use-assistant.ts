// lib/hooks/use-assistant.ts
'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAssistant,
  fetchAssistant,
  fetchAssistantProviders,
  setupAssistant,
  type AssistantInfo,
  type AssistantProvider,
} from '@/lib/api/assistant'

export function useAssistant() {
  return useQuery<AssistantInfo | null>({
    queryKey: ['assistant', 'me'],
    queryFn: fetchAssistant,
    staleTime: 5 * 60 * 1000, // 5 min — assistant mapping changes rarely
  })
}

export function useAssistantProviders() {
  return useQuery<AssistantProvider[]>({
    queryKey: ['assistant', 'providers'],
    queryFn: fetchAssistantProviders,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetupAssistant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setupAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant', 'me'] })
    },
  })
}

export function useDeleteAssistant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant', 'me'] })
    },
  })
}
