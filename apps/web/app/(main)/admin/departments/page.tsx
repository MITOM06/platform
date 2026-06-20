'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { DepartmentsPanel } from '@/components/admin/DepartmentsPanel'

export default function AdminDepartmentsPage() {
  return (
    <RequireCap cap="MANAGE_DEPARTMENTS">
      <DepartmentsPanel />
    </RequireCap>
  )
}
