'use client'

import { useState } from 'react'
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditLog } from '@/lib/hooks/use-admin'
import { useProviderNameSources } from '@/lib/hooks/use-connectors'
import { auditActionKey, auditActorLabel, auditTargetLabel } from '@/lib/admin/audit-labels'

const LIMIT = 20

/**
 * Audit log view — paginated trail of privileged actions (GET /admin/audit).
 * Gated by VIEW_AUDIT_LOG in the shell nav + page wrapper. Every cell is
 * humanized: localized action labels, "System" for automated actions, target
 * names instead of ids (.claude/rules/no-raw-system-data-in-ui.md).
 */
export function AuditLogPanel() {
  const t = useTranslations('admin')
  const locale = useLocale()
  const [page, setPage] = useState(0)
  const { data, isLoading, isError, isPlaceholderData } = useAuditLog(page, LIMIT)
  const providerSources = useProviderNameSources()

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{t('loadError')}</p>
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
        <ClipboardList className="size-12 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold">{t('auditTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('auditEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className="rounded-lg border px-4 py-3" data-testid="audit-row">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {t(auditActionKey(e.action))}
              </Badge>
              <span className="text-sm font-medium">{auditActorLabel(e, t)}</span>
              <span className="text-sm text-muted-foreground">
                · {auditTargetLabel(e, t, providerSources)}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {t('auditRange', {
            from: page * LIMIT + 1,
            to: page * LIMIT + items.length,
            total,
          })}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-4 mr-1" /> {t('auditPrev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1 || isPlaceholderData}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('auditNext')} <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
