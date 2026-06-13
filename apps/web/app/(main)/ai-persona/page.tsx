'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Bot,
  Loader2,
  Info,
  Save,
  RotateCcw,
  Sparkles,
  Camera,
  MessageCircle,
} from 'lucide-react'
import { aiService } from '@/lib/api/ai'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ── Tone chips ───────────────────────────────────────────────────────────────

function ToneSelector({
  value,
  onChange,
  disabled,
  toneLabels,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  toneLabels: Record<string, string>
}) {
  const TONES = [
    { id: 'friendly', icon: '😊' },
    { id: 'professional', icon: '💼' },
    { id: 'concise', icon: '⚡' },
    { id: 'creative', icon: '🎨' },
  ] as const

  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map((t) => {
        const selected = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center gap-1.5 ${
              selected
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span>{t.icon}</span>
            {toneLabels[t.id]}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AiPersonaPage() {
  const t = useTranslations('aiPersona')
  const tc = useTranslations('common')
  const searchParams = useSearchParams()
  const conversationId = searchParams.get('conversationId') ?? ''
  const queryClient = useQueryClient()

  const toneLabels: Record<string, string> = {
    friendly: t('toneAmicable'),
    professional: t('toneProfessional'),
    concise: t('toneConcise'),
    creative: t('toneCreative'),
  }

  const [name, setName] = useState('PON AI')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [tone, setTone] = useState('friendly')
  const [instructions, setInstructions] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await chatService.uploadFile(file)
      setAvatarUrl(res.url)
    } catch {
      toast.error(t('avatarUploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const { data: persona, isLoading } = useQuery({
    queryKey: ['ai-persona', conversationId],
    queryFn: () => aiService.getPersona(conversationId),
    enabled: !!conversationId,
  })

  // Initialize form when data loads
  useEffect(() => {
    if (persona && !initialized) {
      setName(persona.name || 'PON AI')
      setAvatarUrl(persona.avatarUrl || '')
      setTone(persona.tone || 'friendly')
      setInstructions(persona.systemPromptPrefix || '')
      setInitialized(true)
    }
  }, [persona, initialized])

  const saveMutation = useMutation({
    mutationFn: () =>
      aiService.upsertPersona(conversationId, {
        name: name.trim(),
        ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        tone,
        ...(instructions.trim() ? { systemPromptPrefix: instructions.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-persona', conversationId] })
      toast.success(t('saveSuccess'))
    },
    onError: () => toast.error(t('saveError')),
  })

  const resetMutation = useMutation({
    mutationFn: () => aiService.deletePersona(conversationId),
    onSuccess: () => {
      setName('PON AI')
      setAvatarUrl('')
      setTone('friendly')
      setInstructions('')
      setInitialized(false)
      queryClient.invalidateQueries({ queryKey: ['ai-persona', conversationId] })
      toast.success(t('resetSuccess'))
    },
    onError: () => toast.error(t('resetError')),
  })

  const handleSave = () => {
    if (!name.trim()) {
      toast.error(t('botNameRequired'))
      return
    }
    saveMutation.mutate()
  }

  const isBusy = saveMutation.isPending || resetMutation.isPending

  if (!conversationId) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
          <Link href="/conversations" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="font-semibold text-base">{t('title')}</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Bot className="size-16 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {t('openFromConversation')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href={`/conversations/${conversationId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Background glows */}
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#B47FFF]/5 blur-3xl pointer-events-none dark:bg-[#B47FFF]/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />

          <div className="relative max-w-md mx-auto px-6 py-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{tc('loading')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Info banner */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex items-start gap-3">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-primary leading-relaxed">
                    {t('adminOnly')}
                  </p>
                </div>

                {/* Avatar preview + click-to-upload */}
                <div className="flex flex-col items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy || uploading}
                    className="relative group disabled:opacity-60"
                    title={t('avatarUploadLabel')}
                  >
                    <Avatar className="size-20 ring-2 ring-[#B47FFF]/30 ring-offset-2 ring-offset-background">
                      {avatarUrl ? (
                        <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt={name} />
                      ) : (
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-[#B47FFF] to-primary text-white">
                          <Bot className="size-8" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-[#B47FFF] border-2 border-background flex items-center justify-center">
                      {uploading ? (
                        <Loader2 className="size-3 text-white animate-spin" />
                      ) : (
                        <Camera className="size-3 text-white" />
                      )}
                    </div>
                  </button>
                  <span className="text-xs text-muted-foreground">{t('avatarUploadLabel')}</span>
                </div>

                {/* Bot name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Bot className="size-4 text-[#B47FFF]" />
                    {t('botNameLabel')}
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('botNamePlaceholder')}
                    maxLength={30}
                    disabled={isBusy}
                  />
                </div>

                {/* Tone selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="size-4 text-[#B47FFF]" />
                    {t('toneLabel')}
                  </Label>
                  <ToneSelector value={tone} onChange={setTone} disabled={isBusy} toneLabels={toneLabels} />
                </div>

                {/* System instructions */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="size-4 text-[#B47FFF]" />
                    {t('systemPromptLabel')}
                  </Label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={t('systemPromptPlaceholder')}
                    maxLength={500}
                    rows={4}
                    disabled={isBusy}
                    className="flex w-full rounded-lg border border-border bg-input px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  <p className="text-xs text-muted-foreground/50 text-right">
                    {instructions.length}/500
                  </p>
                </div>

                {/* Actions */}
                <Button
                  onClick={handleSave}
                  disabled={isBusy}
                  className="w-full bg-gradient-to-r from-[#B47FFF] to-primary hover:opacity-90 text-white font-semibold h-11 shadow-lg shadow-[#B47FFF]/20"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  {t('save')}
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => resetMutation.mutate()}
                    disabled={isBusy}
                    className="text-sm text-destructive hover:text-destructive/80 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" />
                    {t('reset')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

