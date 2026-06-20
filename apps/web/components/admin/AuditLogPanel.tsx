'use client'

import { useState } from 'react'
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditLog } from '@/lib/hooks/use-admin'

const LIMIT = 20

/**
 * Audit log view — paginated trail of privileged actions (GET /admin/audit).
 * Backed by P0 Part 5. Gated by VIEW_AUDIT_LOG in the shell nav + page wrapper.
 */
export function AuditLogPanel() {
  const t = useTranslations('admin')
  const [page, setPage] = useState(0)
  const { data, isLoading, isPlaceholderData } = useAuditLog(page, LIMIT)

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />

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
          <div key={e.id} className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {e.action}
              </Badge>
              <span className="text-sm font-medium">
                {e.actorName ?? e.actorId}
              </span>
              <span className="text-sm text-muted-foreground">
                · {e.targetType}
                {e.targetId ? ` (${e.targetId})` : ''}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {page * LIMIT + 1}–{page * LIMIT + items.length} / {total}
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
