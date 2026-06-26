'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AssistantPreviewAvatar,
  ASSISTANT_EMOJI_CHOICES,
} from '@/components/chat/assistant/AssistantPreviewAvatar'
import { AssistantModelSelect } from '@/components/chat/assistant/AssistantModelSelect'
import { useAssistantProviders, useSetupAssistant } from '@/lib/hooks/use-assistant'
import { useOpenAssistantChat } from '@/lib/hooks/use-open-assistant-chat'

type Step = 0 | 1 | 2 | 3

export default function AssistantSetupPage() {
  const t = useTranslations('assistantSetup')
  const tc = useTranslations('common')
  const setup = useSetupAssistant()
  const openChat = useOpenAssistantChat()
  const { data: providers = [] } = useAssistantProviders()

  const [step, setStep] = useState<Step>(0)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🤖')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [providerId, setProviderId] = useState('')

  const stepTitles = [t('stepName'), t('stepPersona'), t('stepModel'), t('stepConfirm')]
  const chosenProvider = providers.find((p) => p.id === providerId)

  const canAdvance =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && true) ||
    (step === 2 && providerId.length > 0) ||
    step === 3

  function next() {
    if (step < 3) setStep((step + 1) as Step)
  }
  function back() {
    if (step > 0) setStep((step - 1) as Step)
  }

  async function handleCreate() {
    if (!name.trim() || !providerId) return
    try {
      const res = await setup.mutateAsync({
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        providerId,
      })
      toast.success(t('success'))
      await openChat(res.botUserId)
    } catch {
      toast.error(tc('somethingWrong'))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-8 space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {stepTitles.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col gap-1.5">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              </div>
            ))}
          </div>
          <h2 className="text-lg font-semibold">{stepTitles[step]}</h2>

          {step === 0 && (
            <div className="space-y-5">
              <div className="flex justify-center">
                <AssistantPreviewAvatar emoji={emoji} name={name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assistant-name">{t('stepName')}</Label>
                <Input
                  id="assistant-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  maxLength={40}
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {ASSISTANT_EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`size-10 rounded-lg text-xl flex items-center justify-center border transition-colors ${
                      emoji === e
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="assistant-persona">{t('stepPersona')}</Label>
              <Textarea
                id="assistant-persona"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('personaPlaceholder')}
                rows={6}
                maxLength={2000}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t('personaHint')}</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>{t('stepModel')}</Label>
              <AssistantModelSelect value={providerId} onChange={setProviderId} />
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <AssistantPreviewAvatar emoji={emoji} name={name} className="size-12 text-xl" />
                <span className="font-semibold text-base truncate">{name.trim()}</span>
              </div>
              {systemPrompt.trim() && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                  {systemPrompt.trim()}
                </p>
              )}
              {chosenProvider && (
                <p className="text-xs text-muted-foreground">{chosenProvider.label}</p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={back} disabled={setup.isPending}>
                <ArrowLeft className="size-4 mr-1.5" />
                {tc('back')}
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={next} disabled={!canAdvance} className="flex-1">
                {t('continue')}
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={setup.isPending || !name.trim() || !providerId}
                className="flex-1"
              >
                {setup.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    {t('creating')}
                  </>
                ) : (
                  <>
                    <Check className="size-4 mr-1.5" />
                    {t('createButton')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
