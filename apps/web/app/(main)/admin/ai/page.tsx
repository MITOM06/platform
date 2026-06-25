'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { WorkspaceAiSettings } from '@/components/admin/WorkspaceAiSettings'
import { BotIntegrationPanel } from '@/components/admin/BotIntegrationPanel'

export default function AdminAiPage() {
  return (
    <RequireCap cap="MANAGE_WORKSPACE">
      <div className="space-y-10">
        <WorkspaceAiSettings />
        <BotIntegrationPanel />
      </div>
    </RequireCap>
  )
}
