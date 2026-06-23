'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { UsageDashboard } from '@/components/admin/usage-dashboard'

export default function AdminUsagePage() {
  return (
    <RequireCap cap="MANAGE_WORKSPACE">
      <UsageDashboard />
    </RequireCap>
  )
}
