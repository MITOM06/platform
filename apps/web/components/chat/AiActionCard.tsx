'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Check, Clock, Loader2, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { aiActionsService } from '@/lib/api/ai-actions'
import { useAuthStore } from '@/lib/store/auth.store'
import { useNameResolver } from '@/lib/hooks/use-display-names'
import { useProviderNameSources } from '@/lib/hooks/use-connectors'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { useExpired } from '@/lib/hooks/use-expired'
import { providerDisplayName } from '@/lib/ai/connector-names'
import {
  actionCardState,
  actionErrorOutcome,
  actionSummaryView,
  expiryMs,
  responseStatus,
  type LocalActionOutcome,
} from '@/lib/ai/pending-actions'
import type { AiPendingAction } from '@/lib/api/types'

/**
 * Outcomes this tab already received, by action id. The streaming bubble's card is
 * replaced by the saved message's card when the reply ends; this keeps the answer
 * on screen until the server's `MESSAGE_UPDATED` arrives.
 */
const localOutcomes = new Map<string, LocalActionOutcome>()

interface Props {
  action: AiPendingAction
  conversationId: string
}

/**
 * Confirmation card of a sensitive AI action (CONTRACTS-ROUND2 §F2), inside the
 * AI bubble. Only the requester gets Confirm / Cancel, until `expiresAt`; everyone
 * else sees who has to decide, then the outcome. The server's status (via
 * `MESSAGE_UPDATED`) always wins over this client's optimistic one.
 */
export function AiActionCard({ action, conversationId }: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const me = useAuthStore((s) => s.user?.id)
  const resolveName = useNameResolver(conversationId)
  const providerSources = useProviderNameSources()
  const { setPendingActionStatus } = useMessageCache(conversationId)
  const [local, setLocalState] = useState<LocalActionOutcome | null>(
    () => localOutcomes.get(action.id) ?? null,
  )
  const setLocal = (outcome: LocalActionOutcome) => {
    localOutcomes.set(action.id, outcome)
    setLocalState(outcome)
  }
  const expired = useExpired(expiryMs(action))

  const resolve = useMutation({
    mutationFn: (kind: 'confirm' | 'cancel') =>
      kind === 'confirm' ? aiActionsService.confirm(action.id) : aiActionsService.cancel(action.id),
    onSuccess: (body, kind) => {
      const status = responseStatus(body) ?? (kind === 'confirm' ? 'confirmed' : 'cancelled')
      setLocal(status)
      // Optimistic copy in the thread cache; MESSAGE_UPDATED brings the server's.
      setPendingActionStatus(action.id, status)
      if (status === 'failed') toast.error(t('aiActionFailedToast'))
    },
    onError: (err) => {
      const { key, outcome } = actionErrorOutcome(err)
      if (outcome) setLocal(outcome)
      toast.error(t(key))
    },
  })

  // `now` only matters for the expiry check: past it ⇒ +∞, before it ⇒ 0.
  const state = actionCardState(action, me, expired ? Number.POSITIVE_INFINITY : 0, local)
  const summary = actionSummaryView(action.summary, locale)
  const provider = providerDisplayName(action.provider, providerSources)
  const busy = resolve.isPending

  return (
    <div
      className="mt-2 rounded-lg border border-border bg-card px-3 py-2.5 text-foreground"
      data-testid="ai-action-card"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t(summary.titleKey, summary.titleValues)}</p>
          <p className="text-xs text-muted-foreground">
            {provider ? t('aiActionVia', { connector: provider }) : t('aiActionViaGeneric')}
          </p>
          {summary.lines.length > 0 && (
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
              {summary.lines.map((line) => (
                <div key={line.labelKey} className="contents">
                  <dt className="text-muted-foreground">{t(line.labelKey)}</dt>
                  <dd className="min-w-0 break-words">{line.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
        {state.kind === 'actionable' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => resolve.mutate('cancel')}
            >
              {busy && resolve.variables === 'cancel' && <Loader2 className="size-4 animate-spin" />}
              {t('aiActionCancel')}
            </Button>
            <Button size="sm" disabled={busy} onClick={() => resolve.mutate('confirm')}>
              {busy && resolve.variables === 'confirm' && <Loader2 className="size-4 animate-spin" />}
              {t('aiActionConfirm')}
            </Button>
          </>
        ) : (
          <ActionStatusLabel
            kind={state.kind}
            requesterName={
              state.kind === 'waiting' && state.requesterId
                ? resolveName(state.requesterId)
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

function ActionStatusLabel({
  kind,
  requesterName,
}: {
  kind: Exclude<ReturnType<typeof actionCardState>['kind'], 'actionable'>
  requesterName?: string
}) {
  const t = useTranslations('chat')
  const label =
    kind === 'waiting'
      ? requesterName
        ? t('aiActionWaitingFor', { name: requesterName })
        : t('aiActionWaiting')
      : t(
          {
            confirmed: 'aiActionStatusConfirmed',
            cancelled: 'aiActionStatusCancelled',
            failed: 'aiActionStatusFailed',
            expired: 'aiActionStatusExpired',
            handled: 'aiActionStatusHandled',
          }[kind],
        )
  const Icon =
    kind === 'confirmed' ? Check : kind === 'failed' ? AlertTriangle : kind === 'cancelled' ? X : Clock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        kind === 'failed' ? 'text-destructive' : 'text-muted-foreground',
        kind === 'confirmed' && 'text-foreground',
      )}
      data-testid="ai-action-status"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
