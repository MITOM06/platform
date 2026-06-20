'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { AuditLogPanel } from '@/components/admin/AuditLogPanel'

export default function AdminAuditPage() {
  return (
    <RequireCap cap="VIEW_AUDIT_LOG">
      <AuditLogPanel />
    </RequireCap>
  )
}
