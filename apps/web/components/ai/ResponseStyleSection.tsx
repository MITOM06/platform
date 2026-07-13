'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useUpdateMyStyle } from '@/lib/hooks/use-ai-context'
import type { AiUserContext } from '@/lib/api/ai-context'

export function ResponseStyleSection({ context }: { context: AiUserContext }) {
  const t = useTranslations('aiContext')
  const save = useUpdateMyStyle()
  const [style, setStyle] = useState(context.style ?? '')
  const [prefs, setPrefs] = useState(context.preferences ?? '')
  const [seed, setSeed] = useState(context)
  if (seed !== context) {
    setSeed(context)
    setStyle(context.style ?? '')
    setPrefs(context.preferences ?? '')
  }
  const dirty = style !== (context.style ?? '') || prefs !== (context.preferences ?? '')
  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-muted-foreground" />
        {t('responseStyleTitle')}
      </h2>
      <div className="space-y-2">
        <Label htmlFor="ai-style">{t('styleLabel')}</Label>
        <Textarea
          id="ai-style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={2000}
          placeholder={t('stylePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-prefs">{t('preferencesLabel')}</Label>
        <Textarea
          id="ai-prefs"
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          maxLength={2000}
          placeholder={t('preferencesPlaceholder')}
        />
      </div>
      <Button
        onClick={() => save.mutate({ style, preferences: prefs })}
        disabled={!dirty || save.isPending}
      >
        <Save className="mr-2 size-4" />
        {save.isPending ? t('saving') : t('update')}
      </Button>
    </section>
  )
}
