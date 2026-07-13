'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { aiContextService, type UpsertEntryInput } from '@/lib/api/ai-context'
import { aiService } from '@/lib/api/ai'

// ── Self (current user) ──────────────────────────────────────────────────────

export function useMyAiContext() {
  return useQuery({ queryKey: ['ai-context', 'me'], queryFn: () => aiContextService.getMine() })
}

export function useUpdateMyStyle() {
  const qc = useQueryClient()
  const t = useTranslations('aiContext')
  return useMutation({
    mutationFn: (body: { style?: string; preferences?: string }) =>
      aiContextService.updateMyStyle(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-context', 'me'] })
      toast.success(t('styleSaved'))
    },
    onError: () => toast.error(t('saveError')),
  })
}

export function useMyMemory() {
  return useQuery({ queryKey: ['ai-memory'], queryFn: () => aiService.getMyMemories() })
}

export function useDeleteMemory() {
  const qc = useQueryClient()
  const t = useTranslations('aiContext')
  return useMutation({
    mutationFn: (conversationId: string) => aiService.deleteMemory(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-memory'] })
      toast.success(t('memoryDeleted'))
    },
    onError: () => toast.error(t('deleteError')),
  })
}

// ── Admin: per-member hard fields ──────────────────────────────────────────────

export function useMemberAiContext(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-context', 'user', userId],
    queryFn: () => aiContextService.getUser(userId),
    enabled,
  })
}

export function useUpdateMemberHard() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: { jobTitle?: string; projects?: string[] } }) =>
      aiContextService.updateUserHard(userId, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ai-context', 'user', v.userId] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })
}

// ── Admin: company/department context entries ──────────────────────────────────

export function useContextEntries(scope: 'company' | 'department', scopeId?: string) {
  return useQuery({
    queryKey: ['ai-context', 'entries', scope, scopeId ?? null],
    queryFn: () => aiContextService.listEntries(scope, scopeId),
  })
}

export function useCreateEntry() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  return useMutation({
    mutationFn: (dto: UpsertEntryInput) => aiContextService.createEntry(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-context', 'entries'] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpsertEntryInput }) =>
      aiContextService.updateEntry(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-context', 'entries'] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  return useMutation({
    mutationFn: (id: string) => aiContextService.deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-context', 'entries'] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })
}
