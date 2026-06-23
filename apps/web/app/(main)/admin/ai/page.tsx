'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { WorkspaceAiSettings } from '@/components/admin/WorkspaceAiSettings'

export default function AdminAiPage() {
  return (
    <RequireCap cap="MANAGE_WORKSPACE">
      <WorkspaceAiSettings />
    </RequireCap>
  )
}
