'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { RolesPanel } from '@/components/admin/RolesPanel'

export default function AdminRolesPage() {
  return (
    <RequireCap cap="MANAGE_ROLES">
      <RolesPanel />
    </RequireCap>
  )
}
