'use client'

import { ClipboardList } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Audit log view. The backend (AuditLog schema + GET /admin/audit) ships in P0
 * Part 5; until then this renders a "coming soon" placeholder. The section is
 * already gated by VIEW_AUDIT_LOG in the shell nav.
 */
export function AuditLogPanel() {
  const t = useTranslations('admin')
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
      <ClipboardList className="size-12 text-muted-foreground/50" />
      <h2 className="text-lg font-semibold">{t('auditTitle')}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t('auditComingSoon')}
      </p>
    </div>
  )
}
