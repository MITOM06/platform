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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AssistantModelSelect } from '@/components/chat/assistant/AssistantModelSelect'
import {
  useAssistant,
  useDeleteAssistant,
  useSetupAssistant,
} from '@/lib/hooks/use-assistant'

export default function AssistantSettingsPage() {
  const t = useTranslations('assistantSettings')
  const ts = useTranslations('assistantSetup')
  const tc = useTranslations('common')
  const router = useRouter()
  const { data: assistant, isLoading } = useAssistant()
  const setup = useSetupAssistant()
  const del = useDeleteAssistant()

  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [providerId, setProviderId] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Redirect to setup when no assistant exists (once load settles).
  useEffect(() => {
    if (!isLoading && assistant === null) {
      router.replace('/assistant/setup')
    }
  }, [isLoading, assistant, router])

  // Prefill name once (persona is not returned by GET /me — left empty).
  useEffect(() => {
    if (assistant && !prefilled) {
      setName(assistant.name)
      setPrefilled(true)
    }
  }, [assistant, prefilled])

  async function handleSave() {
    if (!name.trim() || !providerId) return
    try {
      await setup.mutateAsync({
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        providerId,
      })
      toast.success(ts('success'))
    } catch {
      toast.error(tc('somethingWrong'))
    }
  }

  async function handleDelete() {
    try {
      await del.mutateAsync()
      setConfirmOpen(false)
      router.push('/conversations')
    } catch {
      toast.error(tc('somethingWrong'))
    }
  }

  if (isLoading || !assistant) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
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
            disabled={setup.isPending || !name.trim() || !providerId}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
