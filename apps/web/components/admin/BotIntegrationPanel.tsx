'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Copy, Check, KeyRound, Trash2 } from 'lucide-react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  botAdminService,
  type BotSessionSummary,
  type ExternalBot,
  type IssuedToken,
} from '@/lib/api/bot-admin'

/** A copyable read-only field with a clipboard button. */
function CopyField({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onCopy}
          aria-label={copyLabel}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

/**
 * One-time dialog showing the freshly issued token + MCP URL. The token lives
 * only in this component's local state and is discarded on dismiss — it is
 * never written to TanStack Query cache or any store.
 */
function TokenDialog({
  issued,
  onClose,
}: {
  issued: IssuedToken | null
  onClose: () => void
}) {
  const t = useTranslations('botAdmin')
  const tc = useTranslations('common')
  return (
    <Dialog open={issued !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('generateToken')}</DialogTitle>
          <DialogDescription className="text-amber-600 dark:text-amber-400">
            {t('tokenWarning')}
          </DialogDescription>
        </DialogHeader>
        {issued && (
          <div className="space-y-4">
            <CopyField
              label={t('copyToken')}
              value={issued.token}
              copyLabel={t('copyToken')}
            />
            <CopyField
              label={t('mcpUrl')}
              value={issued.mcpUrl}
              copyLabel={t('mcpUrl')}
            />
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>{tc('ok')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Renders the "last used" line for a bot from its session summary. */
function LastUsed({ session }: { session: BotSessionSummary | undefined }) {
  const t = useTranslations('botAdmin')
  const text =
    session?.lastUsedAt != null
      ? `${t('lastUsed')}: ${new Date(session.lastUsedAt).toLocaleString()}`
      : t('neverUsed')
  return <p className="text-xs text-muted-foreground">{text}</p>
}

/** A single registered-bot row with generate/revoke actions. */
function BotRow({
  bot,
  onIssued,
}: {
  bot: ExternalBot
  onIssued: (issued: IssuedToken) => void
}) {
  const t = useTranslations('botAdmin')
  const queryClient = useQueryClient()

  const sessionsKey = ['bot-sessions', bot.ownerUserId]
  const { data: sessions = [] } = useQuery({
    queryKey: sessionsKey,
    queryFn: () => botAdminService.listSessions(bot.ownerUserId),
  })
  const session = sessions.find((s) => s.botUserId === bot.botUserId)

  const issueMut = useMutation({
    mutationFn: () => botAdminService.issue(bot.ownerUserId, bot.botUserId),
    onSuccess: (issued) => {
      onIssued(issued)
      queryClient.invalidateQueries({ queryKey: sessionsKey })
    },
  })

  const revokeMut = useMutation({
    mutationFn: () => botAdminService.revoke(bot.ownerUserId, bot.botUserId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Bot className="size-5 shrink-0 text-pon-cyan" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{bot.name}</p>
          <p className="text-xs text-muted-foreground truncate font-mono">
            {bot.botUserId}
          </p>
          <LastUsed session={session} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => issueMut.mutate()}
          disabled={issueMut.isPending}
        >
          <KeyRound className="size-4 mr-1.5" />
          {t('generateToken')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => revokeMut.mutate()}
          disabled={revokeMut.isPending || !session}
        >
          <Trash2 className="size-4 mr-1.5" />
          {t('revokeToken')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Admin panel: lists registered Bot Factory bots and lets a workspace admin
 * issue a one-time integration token (+ MCP URL) per bot or revoke it. Mirrors
 * the Flutter `BotIntegrationPanel`. Capability-gated by MANAGE_WORKSPACE at the
 * page level (`RequireCap`).
 */
export function BotIntegrationPanel() {
  const t = useTranslations('botAdmin')
  const [issued, setIssued] = useState<IssuedToken | null>(null)

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ['external-bots'],
    queryFn: botAdminService.listExternalBots,
  })

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bot className="size-5 text-pon-cyan" /> {t('title')}
      </h2>

      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : bots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noBotsRegistered')}</p>
      ) : (
        <div className="space-y-2">
          {bots.map((bot) => (
            <BotRow key={bot.id} bot={bot} onIssued={setIssued} />
          ))}
        </div>
      )}

      <TokenDialog issued={issued} onClose={() => setIssued(null)} />
    </section>
  )
}
