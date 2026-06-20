'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { WorkspaceSettings } from '@/components/admin/WorkspaceSettings'

export default function AdminWorkspacePage() {
  return (
    <RequireCap cap="MANAGE_WORKSPACE">
      <WorkspaceSettings />
    </RequireCap>
  )
}
