'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { SsoPanel } from '@/components/admin/SsoPanel'

export default function AdminSsoPage() {
  return (
    <RequireCap cap="MANAGE_WORKSPACE">
      <SsoPanel />
    </RequireCap>
  )
}
