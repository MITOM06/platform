'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAssistantProviders } from '@/lib/hooks/use-assistant'

/**
 * Provider/model picker backed by `GET /api/assistant/providers`.
 * Handles loading / empty states; emits the chosen provider id.
 */
export function AssistantModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const t = useTranslations('assistantSetup')
  const tc = useTranslations('common')
  const { data: providers = [], isLoading } = useAssistantProviders()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" />
        {tc('loading')}
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
        {tc('somethingWrong')}
      </p>
    )
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('stepModel')} />
      </SelectTrigger>
      <SelectContent>
        {providers.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
