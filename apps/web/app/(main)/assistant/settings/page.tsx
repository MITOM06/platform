'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { AssistantModelSelect } from '@/components/chat/assistant/AssistantModelSelect'
import {
  useAssistant,
  useDeleteAssistant,
  useSetupAssistant,
} from '@/lib/hooks/use-assistant'
import { assistantErrorKey, type AssistantInfo } from '@/lib/api/assistant'

export default function AssistantSettingsPage() {
  const router = useRouter()
  const { data: assistant, isLoading } = useAssistant()

  // Redirect to setup when no assistant exists (once load settles).
  useEffect(() => {
    if (!isLoading && assistant === null) {
      router.replace('/assistant/setup')
    }
  }, [isLoading, assistant, router])

  if (isLoading || !assistant) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  // Mount the form only once the assistant is loaded, so its state can be
  // initialized directly from `assistant` (no prefill effect needed).
  return <AssistantSettingsForm assistant={assistant} />
}

function AssistantSettingsForm({ assistant }: { assistant: AssistantInfo }) {
  const t = useTranslations('assistantSettings')
  const ts = useTranslations('assistantSetup')
  const tc = useTranslations('common')
  const router = useRouter()
  const setup = useSetupAssistant()
  const del = useDeleteAssistant()

  // Prefilled from GET /api/assistant/me; a blank value on save keeps the
  // stored one server-side, so saving a rename never wipes the persona / model.
  const [name, setName] = useState(assistant.name)
  const [systemPrompt, setSystemPrompt] = useState(assistant.systemPrompt ?? '')
  const [providerId, setProviderId] = useState(assistant.providerId ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    try {
      await setup.mutateAsync({
        name: name.trim(),
        ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {}),
        ...(providerId ? { providerId } : {}),
      })
      toast.success(ts('saved'))
    } catch (err) {
      toast.error(ts(assistantErrorKey(err)))
    }
  }

  async function handleDelete() {
    try {
      await del.mutateAsync()
      setConfirmOpen(false)
      router.push('/conversations')
    } catch (err) {
      toast.error(ts(assistantErrorKey(err)))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-6 py-8 space-y-6 pb-tabbar md:pb-8">
          <div className="space-y-2">
            <Label htmlFor="assistant-name">{ts('stepName')}</Label>
            <Input
              id="assistant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ts('namePlaceholder')}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistant-persona">{t('editPersona')}</Label>
            <Textarea
              id="assistant-persona"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={ts('personaPlaceholder')}
              rows={6}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{ts('personaHint')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('changeModel')}</Label>
            <AssistantModelSelect value={providerId} onChange={setProviderId} />
          </div>

          <Button
            onClick={handleSave}
            disabled={setup.isPending || !name.trim()}
            className="w-full"
          >
            {setup.isPending ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="size-4 mr-1.5" />
            )}
            {tc('save')}
          </Button>

          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4 mr-1.5" />
              {t('deleteButton')}
            </Button>
          </div>
        </div>
      </div>

      <ResponsiveModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={del.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              {del.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-1.5" />
              )}
              {t('deleteButton')}
            </Button>
          </>
        }
      />
    </div>
  )
}
